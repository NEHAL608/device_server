import { getAuth, getDeviceId, storeApiKeyAndImpulseId, storeDeviceId, getStudioEndpoint } from "./settings";
import { CameraSensor } from "./sensors/camera";
import { Uploader } from "./uploader";
import { ClassificationLoader } from "./classification-loader";
import { dataMessage } from "./messages";
import { Notify } from "./notify";
import { getErrorMsg } from "./utils";
export class CameraDataCollectionClientViews {
    constructor() {
        this._views = {
            loading: document.querySelector('#loading-view'),
            qrcode: document.querySelector('#qrcode-view'),
            connectionFailed: document.querySelector('#remote-mgmt-failed'),
            capture: document.querySelector('#capture-camera'),
            permission: document.querySelector('#permission-view')
        };
        this._elements = {
            deviceId: document.querySelector('#connected-device-id'),
            connectionFailedMessage: document.querySelector('#connection-failed-message'),
            grantPermission: document.querySelector('#grant-permissions-button'),
            loadingText: document.querySelector('#loading-view-text'),
            captureButton: document.querySelector('#capture-camera-button'),
            labelLink: document.querySelector('#camera-label-link'),
            labelText: document.querySelector('#camera-label-text'),
            categoryLink: document.querySelector('#camera-category-link'),
            categoryText: document.querySelector('#camera-category-text'),
            categorySelect: document.querySelector('#camera-category-select'),
            capturedCount: document.querySelector('#images-capture-count')
        };
        this._sensors = [];
        this._numCaptures = 0;
        this._hmacKey = '0';
    }
    async init() {
        var _a, _b, _c, _d, _e;
        storeDeviceId(getDeviceId());
        const camera = new CameraSensor();
        if (!await camera.hasSensor()) {
            this._elements.connectionFailedMessage.textContent = 'No camera detected';
            this.switchView(this._views.connectionFailed);
            return;
        }
        this._sensors.push(camera);
        this._elements.categoryText.style.display = 'none';
        (_a = this._elements.categoryText.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(this._elements.categorySelect, this._elements.categoryText);
        const auth = this._auth = getAuth();
        // data collection can only be done with apiKey
        if (auth && auth.auth === 'apiKey') {
            storeApiKeyAndImpulseId(auth.apiKey, auth.impulseId);
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.delete('apiKey');
            searchParams.delete('studio');
            searchParams.delete('env');
            window.history.replaceState(null, '', window.location.pathname +
                (searchParams.toString().length > 0) ? `?${searchParams.toString()}` : ``);
            try {
                this.switchView(this._views.loading);
                let devKeys = await this.getDevelopmentApiKeys(auth);
                if (devKeys.hmacKey) {
                    this._hmacKey = devKeys.hmacKey;
                }
                const onStartState = {
                    label: (_c = (_b = searchParams.get('label')) !== null && _b !== void 0 ? _b : localStorage.getItem(`last-camera-label`)) !== null && _c !== void 0 ? _c : 'unknown',
                    category: (_e = (_d = searchParams.get('category')) !== null && _d !== void 0 ? _d : localStorage.getItem(`last-camera-category`)) !== null && _e !== void 0 ? _e : 'split'
                };
                if (['training', 'testing', 'split'].indexOf(onStartState.category) === -1) {
                    onStartState.category = 'split';
                }
                console.log('onStartState', onStartState);
                this._elements.labelText.dataset.label = onStartState.label;
                this._elements.labelText.textContent = onStartState.label === '' ?
                    'Unlabeled' :
                    onStartState.label;
                this._elements.categoryText.textContent = onStartState.category;
                this._elements.categorySelect.value = onStartState.category;
                localStorage.setItem(`last-camera-label`, onStartState.label);
                localStorage.setItem(`last-camera-category`, onStartState.category);
                this._uploader = new Uploader(auth.apiKey);
                this._elements.grantPermission.textContent = 'Give access to the camera';
                let sensor = this._sensors.find(s => s.getProperties().name.toLowerCase() === 'camera');
                if (sensor && await sensor.checkPermissions(false)) {
                    console.log('sensor checkPermissions OK');
                    this.grantPermission();
                }
                else {
                    this.switchView(this._views.permission);
                    this._elements.grantPermission.onclick = ev => {
                        this.grantPermission();
                    };
                }
            }
            catch (ex) {
                console.error('Failed to load', ex);
                this._elements.connectionFailedMessage.textContent = getErrorMsg(ex);
                this.switchView(this._views.connectionFailed);
            }
        }
        else {
            this.switchView(this._views.qrcode);
        }
        this._elements.captureButton.onclick = async (ev) => {
            ev.preventDefault();
            if (!this._uploader)
                return;
            let origHtml = this._elements.captureButton.innerHTML;
            try {
                this._elements.captureButton.innerHTML = '<i class="fa fa-camera mr-2"></i>Uploading...';
                this._elements.captureButton.classList.add('disabled');
                console.log('gonna take sample');
                let sample = await camera.takeSnapshot({});
                console.log('took sample');
                if (!sample.attachments || sample.attachments.length === 0 || !sample.attachments[0].value) {
                    throw new Error('Attachment is supposed to present');
                }
                if (!this._auth || this._auth.auth !== 'apiKey') {
                    throw new Error('Not authenticated');
                }
                let category = this._elements.categoryText.textContent || 'training';
                if (this._elements.categoryText.textContent === 'split') {
                    if (this._numCaptures > 0) {
                        category = await this.getCategoryFromBlob(sample.attachments[0].value);
                    }
                    else {
                        category = 'training';
                    }
                }
                this._numCaptures = this._numCaptures + 1;
                let details = {
                    hmacKey: this._hmacKey,
                    interval: 0,
                    label: (this._elements.labelText.dataset.label || '') !== '' ?
                        this._elements.labelText.dataset.label :
                        undefined,
                    length: 0,
                    path: '/api/' + category + '/data',
                    sensor: 'Camera'
                };
                let data = dataMessage({
                    apiKey: this._auth.apiKey,
                    device: {
                        deviceId: getDeviceId(),
                        sensors: [camera].map(s => {
                            let p = s.getProperties();
                            return {
                                name: p.name,
                                frequencies: p.frequencies,
                                maxSampleLength: p.maxSampleLength
                            };
                        }),
                        deviceType: 'MOBILE_CLIENT'
                    }
                }, sample);
                console.log('details', details, 'data', data, 'sample', sample);
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                (async () => {
                    if (!this._uploader)
                        return;
                    /* eslint-disable @typescript-eslint/no-unsafe-call*/
                    try {
                        let filename = await this._uploader.uploadSample(details, data, sample);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        $.notifyClose();
                        Notify.notify('', 'Uploaded "' + filename + '" to ' + category + ' category', 'top', 'center', 'far fa-check-circle', 'success');
                    }
                    catch (ex) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        $.notifyClose();
                        Notify.notify('Failed to upload', getErrorMsg(ex), 'top', 'center', 'far fa-times-circle', 'danger');
                    }
                })();
                // give some indication that the button was pressed
                await this.sleep(100);
                let curr = Number(this._elements.capturedCount.textContent || '0');
                this._elements.capturedCount.textContent = (curr + 1).toString();
            }
            catch (ex) {
                alert('Failed to upload: ' + getErrorMsg(ex));
            }
            finally {
                this._elements.captureButton.innerHTML = origHtml;
                this._elements.captureButton.classList.remove('disabled');
            }
        };
        this._elements.labelLink.onclick = async (ev) => {
            var _a, _b;
            ev.preventDefault();
            const v = await Notify.prompt('Enter a label', '', 'Set label', (_b = (_a = this._elements.labelText.dataset.label) !== null && _a !== void 0 ? _a : this._elements.labelText.textContent) !== null && _b !== void 0 ? _b : '', 'info', 'info');
            if (v !== false) {
                if (v && this._elements.labelText.textContent !== v) {
                    this._elements.capturedCount.textContent = '0';
                }
                this._elements.labelText.textContent = v ?
                    v :
                    'Unlabeled';
                this._elements.labelText.dataset.label = v;
                localStorage.setItem(`last-camera-label`, v);
            }
        };
        this._elements.categorySelect.oninput = () => {
            if (this._elements.categoryText.textContent !== this._elements.categorySelect.value) {
                this._elements.capturedCount.textContent = '0';
            }
            this._elements.categoryText.textContent = this._elements.categorySelect.value;
            localStorage.setItem('last-camera-category', this._elements.categoryText.textContent);
        };
        this._elements.categoryLink.onclick = ev => {
            ev.preventDefault();
            console.log('category link click', ev);
            let element = this._elements.categorySelect;
            let event;
            event = document.createEvent('MouseEvents');
            event.initMouseEvent('mousedown', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            element.dispatchEvent(event);
            // this._elements.categorySelect.focus();
        };
    }
    switchView(view) {
        for (const k of Object.keys(this._views)) {
            this._views[k].style.display = 'none';
        }
        view.style.display = '';
    }
    grantPermission() {
        let sensor = this._sensors.find(s => s.getProperties().name.toLowerCase() === 'camera');
        if (!sensor) {
            this._elements.connectionFailedMessage.textContent = 'Could not find camera';
            this.switchView(this._views.connectionFailed);
            return;
        }
        sensor.checkPermissions(true).then(result => {
            if (result) {
                this.switchView(this._views.capture);
                if (!this._elements.labelText.textContent) {
                    this._elements.labelLink.click();
                }
            }
            else {
                alert('User has rejected camera permissions');
            }
        }).catch(err => {
            console.error(err);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this._elements.connectionFailedMessage.textContent = err;
            this.switchView(this._views.connectionFailed);
        });
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async getDevelopmentApiKeys(auth) {
        let l = new ClassificationLoader(getStudioEndpoint(), auth);
        let projectId = await l.getProject();
        try {
            return await l.getDevelopmentKeys(projectId.id);
        }
        catch (ex) {
            console.warn('Could not find development keys for project ' + projectId, ex);
            return {
                apiKey: undefined,
                hmacKey: undefined
            };
        }
    }
    async getCategoryFromBlob(blob) {
        let hash = await new Promise((resolve, reject) => {
            let a = new FileReader();
            a.readAsArrayBuffer(blob);
            a.onloadend = async () => {
                if (!a.result || typeof a.result === 'string') {
                    return reject('Failed to calculate hash ' + a.error);
                }
                let hashBuffer = await crypto.subtle.digest('SHA-256', a.result);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                resolve(hashHex);
            };
        });
        while (hash.length > 0 && hash[0] === 'f') {
            hash = hash.substr(1);
        }
        if (hash.length === 0) {
            throw new Error('Failed to calculate SHA256 hash of buffer');
        }
        let firstHashChar = hash[0];
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b'].indexOf(firstHashChar) > -1) {
            return 'training';
        }
        else {
            return 'testing';
        }
    }
}
//# sourceMappingURL=camera-collection-views.js.map