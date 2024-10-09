import { DataCollectionClientViews } from "./collection-views";
import { ClassificationClientViews } from "./classification-views";
import { getIngestionApi, storeIngestionApi, getRemoteManagementEndpoint, storeRemoteManagementEndpoint, storeStudioEndpoint, getStudioEndpoint } from "./settings";
import { CameraDataCollectionClientViews } from "./camera-collection-views";
import { DataCollectionKeywordClientViews } from "./collection-keyword";
import { TimeSeriesDataCollectionClientViews } from "./time-series-collection-views";
const mobileClientLoader = async (mode) => {
    storeIngestionApi(getIngestionApi());
    storeRemoteManagementEndpoint(getRemoteManagementEndpoint());
    storeStudioEndpoint(getStudioEndpoint());
    if (mode === 'data-collection') {
        let client = new DataCollectionClientViews();
        await client.init();
        window.client = client;
    }
    else if (mode === 'classifier') {
        let client = new ClassificationClientViews();
        await client.init();
        window.client = client;
    }
    else if (mode === 'data-collection-camera') {
        let client = new CameraDataCollectionClientViews();
        await client.init();
        window.client = client;
    }
    else if (mode === 'data-collection-microphone') {
        let client = new TimeSeriesDataCollectionClientViews();
        await client.init('microphone');
        window.client = client;
    }
    else if (mode === 'data-collection-accelerometer') {
        let client = new TimeSeriesDataCollectionClientViews();
        await client.init('accelerometer');
        window.client = client;
    }
    else if (mode === 'data-collection-keyword') {
        let client = new DataCollectionKeywordClientViews();
        await client.init();
        window.client = client;
    }
    console.log('Hello world from the Edge Impulse mobile client', mode);
};
export default mobileClientLoader;
//# sourceMappingURL=init.js.map