import { sampleRequestReceived, sampleFinished, sampleUploading, dataMessage, helloMessage, sampleRequestFailed, sampleStarted } from "./messages";
import { parseMessage, getErrorMsg } from "./utils";
import { getRemoteManagementEndpoint } from "./settings";
import { Emitter } from "./typed-event-emitter";
import { Uploader } from "./uploader";
export class RemoteManagementConnection extends Emitter {
    constructor(settings, waitForSamplingToStart) {
        super();
        this._socketHeartbeat = -1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.sendMessage = (data) => {
            this._socket.send(JSON.stringify(data));
        };
        this._socket = new WebSocket(getRemoteManagementEndpoint());
        this._state = {
            socketConnected: false,
            remoteManagementConnected: false,
            error: null,
            sample: null,
            isSampling: false
        };
        this._settings = settings;
        this._uploader = new Uploader(settings.apiKey);
        this._socket.onopen = _e => {
            this._state.socketConnected = true;
            this.sendMessage(helloMessage(this._settings));
            this._socketHeartbeat = window.setInterval(() => {
                this._socket.send("ping");
            }, 3000);
        };
        this._socket.onmessage = async (event) => {
            /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
            const data = await parseMessage(event);
            if (!data) {
                return;
            }
            // ping messages are not understood, so skip those
            if (data.err !== undefined && data.err.indexOf('Failed to parse') === -1) {
                this.emit('error', data.err);
            }
            if (data.hello !== undefined) {
                const msg = data.hello;
                this._state.remoteManagementConnected = msg.hello;
                this._state.error = msg.error;
                if (this._state.error) {
                    this.emit('error', this._state.error);
                }
                else {
                    this.emit('connected');
                }
            }
            if (data.sample !== undefined) {
                const msg = data.sample;
                if (!msg || !msg.hmacKey) {
                    this.sendMessage(sampleRequestFailed("Message or hmacKey empty"));
                    return;
                }
                if (!waitForSamplingToStart)
                    return;
                try {
                    this.sendMessage(sampleRequestReceived);
                    let sensor = await waitForSamplingToStart(msg.sensor);
                    // Start to sample
                    this._state.sample = msg;
                    this._state.isSampling = true;
                    if (msg.sensor !== 'Camera') {
                        this.sendMessage(sampleStarted);
                    }
                    const sampleDetails = {
                        ...msg
                    };
                    this.emit('samplingStarted', msg.length);
                    const sampleData = await sensor.takeSample({
                        length: msg.length,
                        frequency: 1000 / msg.interval,
                        processing: () => {
                            this.emit('samplingProcessing');
                        }
                    });
                    // Upload sample
                    try {
                        this.emit('samplingUploading');
                        this.sendMessage(sampleUploading);
                        await this._uploader.uploadSample(sampleDetails, dataMessage(this._settings, sampleData), sampleData);
                        this.sendMessage(sampleFinished);
                        this.emit('samplingFinished');
                    }
                    catch (ex) {
                        alert(getErrorMsg(ex));
                    }
                    finally {
                        this._state.sample = msg;
                        this._state.isSampling = false;
                    }
                }
                catch (ex) {
                    this.emit('samplingFinished');
                    this.emit('samplingError', getErrorMsg(ex));
                    this.sendMessage(sampleRequestFailed(getErrorMsg(ex)));
                }
            }
            /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
            /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
        };
        this._socket.onclose = event => {
            clearInterval(this._socketHeartbeat);
            const msg = event.wasClean ?
                // e.g. server process killed or network down
                `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}` :
                // event.code is usually 1006 in this case
                "[close] Connection died";
            this._state.socketConnected = false;
            this._state.remoteManagementConnected = false;
            this._state.error = msg;
            this.emit('error', this._state.error);
        };
        this._socket.onerror = error => {
            this._state.socketConnected = false;
            this._state.remoteManagementConnected = false;
            this._state.error = error;
            this.emit('error', this._state.error);
        };
    }
    readAsBinaryStringAsync(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });
    }
}
//# sourceMappingURL=remote-mgmt.js.map