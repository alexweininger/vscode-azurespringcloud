import { AppPlatformManagementClient } from "@azure/arm-appplatform";
import { AppResource, DeploymentResource, ResourceUploadDefinition, RuntimeVersion, TestKeys } from "@azure/arm-appplatform/esm/models";
import { DeploymentInstance } from "@azure/arm-appplatform/src/models/index";
import { AnonymousCredential, ShareFileClient } from "@azure/storage-file-share";
import { EnhancedApp, IApp, IDeployment } from "../model";
import { localize } from "../utils";
import { startStreamingLogs, stopStreamingLogs } from "./streamlog/streamingLog";

export class AppService {
    // tslint:disable-next-line:no-unexternalized-strings
    public static readonly DEFAULT_RUNTIME: RuntimeVersion = "Java_8";
    // tslint:disable-next-line:no-unexternalized-strings
    public static readonly DEFAULT_DEPLOYMENT: string = "default";

    private readonly client: AppPlatformManagementClient;
    private readonly target: IApp | undefined;

    public constructor(client: AppPlatformManagementClient, app?: IApp) {
        this.client = client;
        this.target = app;
    }

    public enhanceApp(app: IApp): EnhancedApp {
        const appService: AppService = new AppService(this.client, app);
        return Object.assign(appService, app);
    }

    public async start(app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.deployments.start(target.service.resourceGroup, target.service.name, target.name, target.properties?.activeDeploymentName!);
    }

    public async stop(app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.deployments.stop(target.service.resourceGroup, target.service.name, target.name, target.properties?.activeDeploymentName!);
    }

    public async restart(app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.deployments.restart(target.service.resourceGroup, target.service.name, target.name, target.properties?.activeDeploymentName!);
    }

    public async remove(app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.apps.deleteMethod(target.service.resourceGroup, target.service.name, target.name);
    }

    public async reload(app?: IApp): Promise<IApp> {
        const target: IApp = this.getTarget(app);
        const resouce: AppResource = await this.client.apps.get(target.service.resourceGroup, target.service.name, target.name);
        return IApp.fromResource(resouce, target.service);
    }

    public async getActiveDeployment(app?: IApp): Promise<IDeployment> {
        const target: IApp = this.getTarget(app);
        const deploymentName: string = target.properties?.activeDeploymentName!;
        const deployment: DeploymentResource = await this.client.deployments.get(target.service.resourceGroup, target.service.name, target.name, deploymentName);
        return IDeployment.fromResource(deployment, target);
    }

    public async setActiveDeployment(deploymentName: string, app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.apps.createOrUpdate(target.service.resourceGroup, target.service.name, target.name, {
            properties: {
                activeDeploymentName: deploymentName,
            }
        });
    }

    public async createDeployment(name: string, runtime: RuntimeVersion, app?: IApp): Promise<IDeployment> {
        const target: IApp = this.getTarget(app);
        // refer: https://dev.azure.com/msazure/AzureDMSS/_git/AzureDMSS-PortalExtension?path=%2Fsrc%2FSpringCloudPortalExt%2FClient%2FShared%2FAppsApi.ts&version=GBdev&_a=contents
        const resource: DeploymentResource = await this.client.deployments.createOrUpdate(target.service.resourceGroup, target.service.name, target.name, name, {
            properties: {
                source: {
                    type: 'Jar',
                    relativePath: '<default>'
                },
                deploymentSettings: {
                    memoryInGB: 1,
                    runtimeVersion: runtime ?? AppService.DEFAULT_RUNTIME
                },
            },
            sku: {
                capacity: 1,
                // When PUT a deployment, the Sku.tier and Sku.name are required but ignored by service side.
                // Hard code these un-used required properties.
                // https://msazure.visualstudio.com/AzureDMSS/_workitems/edit/8082098/
                tier: 'Standard',
                name: 'S0',
            }
        });
        return IDeployment.fromResource(resource, target);
    }

    public async startDeployment(name: string, app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.deployments.start(target.service.resourceGroup, target.service.name, target.name, name);
    }

    public async getTestKeys(app?: IApp): Promise<TestKeys> {
        const target: IApp = this.getTarget(app);
        return await this.client.services.listTestKeys(target.service.resourceGroup, target.service.name);
    }

    public async getTestEndpoint(app?: IApp): Promise<string | undefined> {
        const target: IApp = this.getTarget(app);
        const testKeys: TestKeys | undefined = await this.getTestKeys(app);
        return `${testKeys.primaryTestEndpoint}/${target.name}/default`;
    }

    public async getPublicEndpoint(app?: IApp): Promise<string | undefined> {
        const target: IApp = this.getTarget(app);
        if (target.properties?.url && target.properties?.url !== 'None') {
            return target.properties?.url;
        }
        return undefined;
    }

    public async setPublic(isPublic: boolean, app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await this.client.apps.createOrUpdate(target.service.resourceGroup, target.service.name, target.name, {
            properties: {
                activeDeploymentName: this.target?.properties?.activeDeploymentName,
                publicProperty: isPublic
            }
        });
    }

    public async getUploadDefinition(app?: IApp): Promise<ResourceUploadDefinition> {
        const target: IApp = this.getTarget(app);
        return this.client.apps.getResourceUploadUrl(target.service.resourceGroup, target.service.name, target.name);
    }

    public async uploadArtifact(path: string, app?: IApp): Promise<ResourceUploadDefinition> {
        const target: IApp = this.getTarget(app);
        const uploadDefinition: ResourceUploadDefinition = await this.getUploadDefinition(target);
        const fileClient: ShareFileClient = new ShareFileClient(uploadDefinition.uploadUrl!, new AnonymousCredential());
        await fileClient.uploadFile(path);
        return uploadDefinition;
    }

    public async startStreamingLogs(instance: DeploymentInstance, app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        if (instance.status !== 'Running') {
            throw new Error(localize('instanceNotRunning', 'Selected instance is not running.'));
        }
        const testKey: TestKeys = await this.getTestKeys(target);
        await startStreamingLogs(target.name, testKey, instance);
    }

    public async stopStreamingLogs(instance: DeploymentInstance, app?: IApp): Promise<void> {
        const target: IApp = this.getTarget(app);
        await stopStreamingLogs(target.name, instance);
    }

    private getTarget(app?: IApp): IApp {
        // @ts-ignore
        return app ?? this.target;
    }
}