import { Progress } from "vscode";
import { AzureWizardExecuteStep } from "vscode-azureextensionui";
import { ext } from "../../../extensionVariables";
import { EnhancedDeployment } from "../../../model";
import { localize } from "../../../utils";
import { IAppDeploymentWizardContext } from "./IAppDeploymentWizardContext";

export class UpdateDeploymentStep extends AzureWizardExecuteStep<IAppDeploymentWizardContext> {

    // tslint:disable-next-line: no-unexternalized-strings
    public priority: number = 140;
    private readonly deployment: EnhancedDeployment;

    constructor(deployment: EnhancedDeployment) {
        super();
        this.deployment = deployment;
    }

    public async execute(context: IAppDeploymentWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const message: string = localize('updateDeployment', 'Updating deployment...');
        ext.outputChannel.appendLog(message);
        progress.report({ message });
        await this.deployment.updateArtifactPath(context.uploadDefinition?.relativePath!);
        return Promise.resolve(undefined);
    }

    public shouldExecute(_context: IAppDeploymentWizardContext): boolean {
        return true;
    }
}