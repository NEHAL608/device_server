import { createSignature } from "./utils";
import { getIngestionApi } from "./settings";
export class Uploader {
    constructor(apiKey) {
        this._apiKey = apiKey;
    }
    encodeLabel(header) {
        let encodedHeader;
        try {
            encodedHeader = encodeURIComponent(header);
        }
        catch (ex) {
            encodedHeader = header;
        }
        return encodedHeader;
    }
    async uploadSample(details, data, sampleData) {
        console.log('uploader uploadSample', details, data, sampleData);
        data.signature = await createSignature(details.hmacKey, data);
        let formData = new FormData();
        formData.append("message", new Blob([(JSON.stringify(data))], { type: "application/json" }), "message.json");
        if (sampleData.attachments && sampleData.attachments[0].value) {
            formData.append("image", sampleData.attachments[0].value, "image.jpg");
        }
        return new Promise((resolve, reject) => {
            let xml = new XMLHttpRequest();
            xml.onload = () => {
                if (xml.status === 200) {
                    resolve(xml.responseText);
                }
                else {
                    reject('Failed to upload (status code ' + xml.status + '): ' + xml.responseText);
                }
            };
            xml.onerror = () => reject(undefined);
            xml.open("post", getIngestionApi() + details.path);
            xml.setRequestHeader("x-api-key", this._apiKey);
            if (!details.label) {
                xml.setRequestHeader('x-no-date-id', '1');
                xml.setRequestHeader('x-no-label', '1');
                xml.setRequestHeader("x-file-name", 'sample' + Date.now());
            }
            else {
                xml.setRequestHeader("x-file-name", this.encodeLabel(details.label));
            }
            xml.send(formData);
        });
    }
}
//# sourceMappingURL=uploader.js.map