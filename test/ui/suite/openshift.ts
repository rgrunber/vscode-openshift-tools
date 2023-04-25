/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { ActivityBar, By, CustomTreeSection, EditorView, InputBox, SideBarView, ViewSection, WebElement, WebView, WelcomeContentButton, WelcomeContentSection, Workbench } from 'vscode-extension-tester';
import { BUTTONS, VIEWS } from '../common/constants';
import path = require('path');
import * as fs from 'fs-extra';
import { notificationExists } from '../common/conditions';

export function checkOpenshiftView() {
    describe('OpenShift View', () => {
        let view: SideBarView;
        let editorView: EditorView;
        const tempDir: string = path.join(__dirname, 'temp');

        before(async function context() {
            this.timeout(10000);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            editorView = (new Workbench().getEditorView());
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        });

        it('Displays all view sections', async () => {
            const expected = [VIEWS.appExplorer, VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions];
            const content = view.getContent();
            for (const sectionTitle of expected) {
                const section = await content.getSection(sectionTitle);
                expect(await section.getTitle()).to.eq(sectionTitle);
                await section.collapse();
            }
        });

        describe('Application Explorer', () => {
            let explorer: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                explorer = await view.getContent().getSection(VIEWS.appExplorer);
                await explorer.expand();
                welcome = await explorer.findWelcomeContent();

                for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions]) {
                    await (await view.getContent().getSection(item)).collapse();
                }
            });

            after('remove temp dir', () => {
                if (fs.existsSync(tempDir)) {
                    fs.removeSync(tempDir);
                }
            });

            beforeEach('clear temp dir', () => {
                if (fs.existsSync(tempDir)) {
                    fs.removeSync(tempDir);
                }
                fs.mkdirSync(tempDir);
            });

            it('shows welcome content when not logged in', async () => {
                expect(welcome).not.undefined;
                const description = (await welcome.getTextSections()).join('');
                expect(description).not.empty;
            });

            it('shows buttons for basic actions when logged out', async () => {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async btn => btn.getTitle()));
                const expected = [BUTTONS.login, BUTTONS.kubeContext, BUTTONS.addCluster];

                for (const btn of expected) {
                    expect(titles).includes(btn);
                }
            });

            it('shows more actions on hover', async () => {
                const actions = await explorer.getActions();
                expect(actions).length.above(3);
            });

            it('Import project from git', async () => {

                await editorView.closeAllEditors();
                const buttons: WelcomeContentButton[] = await welcome.getButtons();
                let importButton: WelcomeContentButton;
                for (const btn of buttons) {
                    const title = await btn.getTitle();
                    if (title === 'Import from Git') {
                        importButton = btn;
                        break;
                    }
                }
                await importButton.click();
                await editorView.openEditor('Git Import');

                let elements: WebElement[];
                const webview = new WebView();

                await webview.switchToFrame(); // START WEBVIEW CODE

                elements = await webview.findWebElements(By.xpath('//input[@id="bootstrap-input"]'));
                const importTextBox = elements[0];
                await importTextBox.sendKeys('https://github.com/eclipse/lemminx');

                elements  = await webview.findWebElements(By.xpath('//button[contains(text(),"Analyze")]'));
                const analyzeButton = elements[0];
                await analyzeButton.click();

                await webview.switchBack(); // END WEBVIEW CODE

                const fileDialog = await InputBox.create();
                await fileDialog.setText(tempDir);
                await fileDialog.confirm();
                await new Promise(res => setTimeout(res, 5000)); // wait for clone operation to complete

                await webview.switchToFrame(); // START WEBVIEW CODE

                elements = await webview.findWebElements(By.xpath('//p[contains(text(),"Here is the recommended devfile")]'));
                expect(elements).length.greaterThan(0);

                elements = await webview.findWebElements(By.xpath('//div[@data-testid = "card-java-maven"]'));
                expect(elements).length.greaterThan(0);

                elements  = await webview.findWebElements(By.xpath('//button[contains(text(),"Create Component")]'));
                expect(elements).length.greaterThan(0);
                const createButton = elements[0];
                expect(await createButton.isEnabled()).is.true;
                await createButton.click();

                await webview.switchBack(); // END WEBVIEW CODE

                await notificationExists('Component \'lemminx-comp\' successfully created. Perform actions on it from Components View.', webview.getDriver(), 3000);
            }).timeout(20000);
        });

        describe('Components', () => {
            let section: ViewSection;
            let welcome: WelcomeContentSection;

            before(async () => {
                section = await view.getContent().getSection(VIEWS.components);
                await section.expand();
                welcome = await section.findWelcomeContent();
            });

            it('shows welcome content when not logged in', async () => {
                expect(welcome).not.undefined;
                expect((await welcome.getTextSections()).join('')).not.empty;
            });

            it('shows a button to create a new component', async () => {
                const btns = await welcome.getButtons();
                const titles = await Promise.all(btns.map(async item => await item.getTitle()));

                expect(titles).includes(BUTTONS.newComponent);
            });
        });

        describe('Devfile Registries', () => {
            let registries: CustomTreeSection;

            before(async () => {
                registries = await view.getContent().getSection(VIEWS.compRegistries) as CustomTreeSection;
                await registries.expand();
            });

            it('shows the default devfile registry', async function test() {
                this.timeout(10000);
                await new Promise((res) => { setTimeout(res, 6000); });
                const registry = await registries.findItem(VIEWS.devFileRegistry);
                expect(registry).not.undefined;
            });
        });
    });
}
