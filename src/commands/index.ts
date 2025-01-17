// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { openInPortal } from '@microsoft/vscode-azext-azureutils';
import {
    CommandCallback,
    IActionContext,
    IParsedError, parseError,
    registerCommand
} from '@microsoft/vscode-azext-utils';
import { commands } from 'vscode';
import { instrumentOperation } from 'vscode-extension-telemetry-wrapper';
import { ext } from '../extensionVariables';
import { AppInstanceTreeItem } from '../tree/AppInstanceTreeItem';
import { AppTreeItem } from "../tree/AppTreeItem";
import { ServiceTreeItem } from '../tree/ServiceTreeItem';
import { SubscriptionTreeItem } from '../tree/SubscriptionTreeItem';
import { showError } from '../utils';
import { AppCommands } from "./AppCommands";
import { ServiceCommands } from "./ServiceCommands";

export function registerCommands(): void {
    registerCommandWithTelemetryWrapper('azureSpringApps.common.loadMore', loadMore);
    registerCommandWithTelemetryWrapper('azureSpringApps.common.refresh', refreshNode);
    registerCommandWithTelemetryWrapper('azureSpringApps.common.toggleVisibility', AppCommands.toggleVisibility);
    registerCommandWithTelemetryWrapper('azureSpringApps.subscription.select', selectSubscription);
    registerCommandWithTelemetryWrapper('azureSpringApps.subscription.createServiceFromPortal', ServiceCommands.createServiceInPortal);
    registerCommandWithTelemetryWrapper('azureSpringApps.subscription.openInPortal', openPortal);
    registerCommandWithTelemetryWrapper('azureSpringApps.apps.createApp', ServiceCommands.createApp);
    registerCommandWithTelemetryWrapper('azureSpringApps.apps.delete', ServiceCommands.deleteService);
    registerCommandWithTelemetryWrapper('azureSpringApps.apps.openInPortal', ServiceCommands.openPortal);
    registerCommandWithTelemetryWrapper('azureSpringApps.apps.viewProperties', ServiceCommands.viewProperties);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.openPublicEndpoint', AppCommands.openPublicEndpoint);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.openTestEndpoint', AppCommands.openTestEndpoint);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.assignEndpoint', AppCommands.assignEndpoint);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.unassignEndpoint', AppCommands.unassignEndpoint);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.start', AppCommands.startApp);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.stop', AppCommands.stopApp);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.restart', AppCommands.restartApp);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.delete', AppCommands.deleteApp);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.deploy', AppCommands.deploy);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.scale', AppCommands.scale);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.openInPortal', AppCommands.openPortal);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.viewProperties', AppCommands.viewProperties);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.enableRemoteDebugging', AppCommands.enableRemoteDebugging);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.disableRemoteDebugging', AppCommands.disableRemoteDebugging);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.instance.startRemoteDebugging', AppCommands.startRemoteDebugging);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.instance.startStreamingLog', AppCommands.startStreamingLogs);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.instance.stopStreamingLog', AppCommands.stopStreamingLogs);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.instance.viewProperties', AppCommands.viewInstanceProperties);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.settings.add', AppCommands.addSetting);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.settings.edit', AppCommands.editSettings);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.setting.edit', AppCommands.editSetting);
    registerCommandWithTelemetryWrapper('azureSpringApps.app.setting.delete', AppCommands.deleteSetting);
}

function registerCommandWithTelemetryWrapper(commandId: string, callback: CommandCallback): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const callbackWithTroubleshooting: CommandCallback = (context: IActionContext, ...args: []) => instrumentOperation(commandId, async () => {
        try {
            await callback(context, ...args);
        } catch (error) {
            const e: IParsedError = parseError(error);
            if (!e.isUserCancelledError) {
                // tslint:disable-next-line: no-unsafe-any
                showError(commandId, error);
            }
            throw error;
        }
    })();
    registerCommand(commandId, callbackWithTroubleshooting);
}

type SpringCloudResourceTreeItem = ServiceTreeItem | AppTreeItem | AppInstanceTreeItem;

async function refreshNode(context: IActionContext, node: SpringCloudResourceTreeItem): Promise<void> {
    return ext.tree.refresh(context, node);
}

async function loadMore(context: IActionContext, node: SpringCloudResourceTreeItem): Promise<void> {
    return ext.tree.loadMore(node, context);
}

async function selectSubscription(): Promise<void> {
    return commands.executeCommand('azure-account.selectSubscriptions');
}

async function openPortal(context: IActionContext, node?: SubscriptionTreeItem): Promise<void> {
    node = node ?? await ext.tree.showTreeItemPicker<SubscriptionTreeItem>(SubscriptionTreeItem.contextValue, context);
    return openInPortal(node, node.fullId);
}
