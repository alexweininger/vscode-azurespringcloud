// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { Progress } from "vscode";
import { ext } from "../../../extensionVariables";
import { EnhancedApp } from "../../../service/EnhancedApp";
import { localize } from "../../../utils";
import { IAppDeploymentWizardContext } from "./IAppDeploymentWizardContext";

export class UploadArtifactStep extends AzureWizardExecuteStep<IAppDeploymentWizardContext> {
    public priority: number = 135;
    private readonly app: EnhancedApp;
    private readonly artifactPath: string;

    constructor(app: EnhancedApp, artifactPath: string) {
        super();
        this.app = app;
        this.artifactPath = artifactPath;
    }

    public async execute(context: IAppDeploymentWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const message: string = localize('uploadingArtifact', 'Uploading artifact "{0}" to Azure...', this.artifactPath);
        ext.outputChannel.appendLog(message);
        progress.report({ message });
        context.relativePathOrBuildResultId = await this.app.uploadArtifact(this.artifactPath);
        if (this.app?.service.sku?.name?.toLowerCase().startsWith('e')) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            context.relativePathOrBuildResultId = await this.app.enqueueBuild(context.relativePathOrBuildResultId!);
        }
        ext.outputChannel.appendLog(localize('uploadingArtifactSuccess', 'Successfully uploaded artifact "{0}".', this.artifactPath));
    }

    public shouldExecute(_context: IAppDeploymentWizardContext): boolean {
        return true;
    }
}
