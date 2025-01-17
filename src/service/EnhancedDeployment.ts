// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AppPlatformManagementClient, DeploymentResource, DeploymentResourceProperties, DeploymentSettings, JarUploadedUserSourceInfo, RemoteDebugging, ResourceRequests, Sku } from "@azure/arm-appplatform";
import { IScaleSettings } from "../model";
import { localize } from "../utils";
import { EnhancedApp } from "./EnhancedApp";

export class EnhancedDeployment {
    private static readonly VALID_ENV_VAR_KEY: RegExp = /^[a-zA-Z_][\w.-]*$/;
    private static readonly DEFAULT_DEPLOYMENT_NAME: string = 'default';

    public readonly name: string;
    public readonly id: string;
    public readonly app: EnhancedApp;
    private _remote: DeploymentResource;

    public constructor(app: EnhancedApp, resource: DeploymentResource) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.name = resource.name!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.id = resource.id!;
        this.app = app;
        this._remote = resource;
    }

    public static validateKey(v: string): string | undefined {
        if (!v.trim()) {
            return localize("emptyEnvVarKey", `The key can not be empty.`);
        } else if (!EnhancedDeployment.VALID_ENV_VAR_KEY.test(v)) {
            return localize("invalidEnvVarKey", `
                        Keys must start with a letter or an underscore(_).
                        Keys may only contain letters, numbers, periods(.), and underscores(_).
                    `);
        } else if (v.trim().length > 4000) {
            return localize("maxLength", `The maximum length is {0} characters.`, 4000);
        }
        return undefined;
    }

    public static validateVal(v: string): string | undefined {
        if (!v.trim()) {
            return localize("emptyEnvVarVal", `The value can not be empty.`);
        } else if (v.trim().length > 4000) {
            return localize("maxLength", `The maximum length is {0} characters.`, 4000);
        }
        return undefined;
    }

    public get properties(): DeploymentResourceProperties | undefined {
        return this._remote.properties;
    }

    private get client(): AppPlatformManagementClient {
        return this.app.client;
    }

    public async refresh(): Promise<EnhancedDeployment> {
        this._remote = await this.client.deployments.get(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name);
        return this;
    }

    public async updateArtifactPath(relativePathOrBuildId: string): Promise<void> {
        let properties: DeploymentResourceProperties | undefined;
        if (this.app.service.isEnterpriseTier()) {
            properties = {
                source: { type: 'BuildResult', buildResultId: relativePathOrBuildId }
            };
        } else {
            properties = {
                source: { type: 'Jar', relativePath: relativePathOrBuildId }
            };
        }
        this._remote = await this.client.deployments.beginUpdateAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name,
            this.name || EnhancedDeployment.DEFAULT_DEPLOYMENT_NAME, { properties });
    }

    public async updateScaleSettings(settings: IScaleSettings): Promise<void> {
        const rawMem: number = settings.memory ?? 1;
        const rawCpu: number = settings.cpu ?? 1;
        const sku: Sku | undefined = this.app.service.sku;
        const cpu: string = rawCpu < 1 ? `${rawCpu * 1000}m` : `${Math.floor(rawCpu)}`;
        const memory: string = rawMem < 1 ? `${rawMem * 1024}Mi` : `${Math.floor(rawMem)}Gi`;
        const resource: DeploymentResource = {
            properties: {
                deploymentSettings: {
                    resourceRequests: { cpu, memory }
                }
            },
            sku: {
                ...sku, capacity: settings.capacity ?? sku?.capacity
            }
        };
        this._remote = await this.client.deployments.beginUpdateAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name, resource);
    }

    public async updateEnvironmentVariables(environmentVariables: { [p: string]: string }): Promise<void> {
        this._remote = await this.client.deployments.beginUpdateAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name, {
            properties: { deploymentSettings: { environmentVariables } }
        });
    }

    public getJvmOptions(): string {
        const enterpriseOptionsStr: string | undefined = this.properties?.deploymentSettings?.environmentVariables?.JAVA_OPTS;
        const oldOptionsStr: string | undefined = (<JarUploadedUserSourceInfo>this.properties?.source)?.jvmOptions;
        return enterpriseOptionsStr ?? oldOptionsStr?.trim() ?? '';
    }

    public async updateJvmOptions(jvmOptions: string): Promise<void> {
        if (this.app.service.isEnterpriseTier()) {
            const environmentVariables: { [p: string]: string } = this.properties?.deploymentSettings?.environmentVariables ?? {};
            environmentVariables.JAVA_OPTS = jvmOptions;
            this._remote = await this.client.deployments.beginUpdateAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name, {
                properties: { deploymentSettings: { environmentVariables } }
            });
        } else {
            this._remote = await this.client.deployments.beginUpdateAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name, {
                properties: {
                    source: {
                        type: 'Jar',
                        jvmOptions
                    }
                }
            });
        }
    }

    public getScaleSettings(): IScaleSettings {
        const settings: DeploymentSettings | undefined = this.properties?.deploymentSettings;
        const resourceRequests: ResourceRequests | undefined = settings?.resourceRequests;
        const cpu: number = resourceRequests?.cpu ? (resourceRequests?.cpu?.endsWith('m') ?
            parseInt(resourceRequests?.cpu) / 1000 :
            parseInt(resourceRequests?.cpu)) : 1;
        const memory: number = resourceRequests?.memory ? (resourceRequests?.memory?.endsWith('Mi') ?
            parseInt(resourceRequests?.memory) / 1024 :
            parseInt(resourceRequests?.memory)) : 1;
        return { cpu, memory, capacity: this.properties?.instances?.length ?? 0 };
    }

    public async getDebuggingConfig(): Promise<RemoteDebugging> {
        return this.client.deployments.getRemoteDebuggingConfig(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name);
    }

    public async enableDebugging(port: number = 5005): Promise<RemoteDebugging> {
        return this.client.deployments.beginEnableRemoteDebuggingAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name, {
            remoteDebuggingPayload: { port }
        });
    }

    public async disableDebugging(): Promise<void> {
        await this.client.deployments.beginDisableRemoteDebuggingAndWait(this.app.service.resourceGroup, this.app.service.name, this.app.name, this.name);
    }
}
