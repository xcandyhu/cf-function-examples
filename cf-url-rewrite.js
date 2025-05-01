// must use cloudfront-js-2.0 if you want to use CF key-value store
// it use CF key-value store as source to replace certain values in the URL path
import cf from 'cloudfront';

const kvsId = 'your kvs ID';
const loggingEnabled = true;

async function handler(event) {
    const request = event.request;
    const pathSegments = request.uri.split('/');
    // uri path is like /abc/123/...
    const env = pathSegments[1];
    const appName = pathSegments[2];
    const app = `${env}.${appName}`
    
    const exist = await validateKeyKvs(app);

    if (exist) {
        try {
            log(`found mapping for ${app}`);
            const realAppName = await getValueKvs(app);
            // If the app is found in the key-value store
            if (realAppName) {
                pathSegments[2] = realAppName;
                const newUri = pathSegments.join('/')
                log(`mapping ${request.uri} -> ${newUri}`);
                request.uri = newUri;
                return request;
            }
        } catch (err) {
            log(`request uri: ${request.uri}, error: ${err}`);
        }
    }

    // no change
    return event.request;
}

async function getValueKvs(key) {
    const kvsHandle = cf.kvs(kvsId);
    const kvsResponse = await kvsHandle.get(key);
    if (kvsResponse) {
        return kvsResponse;
    } 
    return null;
}

async function validateKeyKvs(key) {
    const kvsHandle = cf.kvs(kvsId);
    const exist = await kvsHandle.exists(key)
    return exist;
}

function log(message) {
    if (loggingEnabled) {
        console.log(message);
    }
}
