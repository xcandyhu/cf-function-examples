// note: must use AWS SDK for JS v3 for node >= 18
// 1. pulls values from SSM parameter store under a certain path. 
// 2. aggregate and combine all the parameters into a json, for example if the path to search for is '/my/parameter/path/'
//    , and one parameter is '/my/parameter/preprod/key1/description', the value will be put into {"preprod": {"key1": {"description": parameter-value}}}. 
// 3. Construct response with status 200 and the json string.
// name the file as index.mjs in lambda
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

export const handler = async (event) => {
    const ssmClient = new SSMClient({ region: 'us-east-1' });
    const basePath = '/my/parameter/path/';

    try {
        const parameters = await getAllParameters(ssmClient, basePath);
        const result = transformParameters(parameters, basePath);

        const response = {
            status: '200',
            statusDescription: 'OK',
            headers: {
                'cache-control': [{
                    key: 'Cache-Control',
                    value: 'max-age=100'
                }],
                'content-type': [{
                    key: 'Content-Type',
                    value: 'application/json'
                }]
            },
            body: JSON.stringify(result)
        };

        return response;

    } catch (error) {
        console.error('Error:', error);
        return {
            status: '500',
            statusDescription: 'Internal Server Error',
            headers: {
                'content-type': [{
                    key: 'Content-Type',
                    value: 'application/json'
                }]
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function getAllParameters(client, path, nextToken = null) {
    const params = {
        Path: path,
        Recursive: true,
        WithDecryption: true
    };

    if (nextToken) {
        params.NextToken = nextToken;
    }

    const command = new GetParametersByPathCommand(params);
    const response = await client.send(command);
    
    let parameters = response.Parameters || [];

    if (response.NextToken) {
        const moreParameters = await getAllParameters(client, path, response.NextToken);
        parameters = [...parameters, ...moreParameters];
    }

    return parameters;
}

function transformParameters(parameters, basePath) {
    const result = {};

    parameters.forEach(param => {
        const relativePath = param.Name.substring(basePath.length);
        const parts = relativePath.split('/').filter(part => part !== '');
        
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        
        const lastPart = parts[parts.length - 1];
        // Check if the parameter is a StringList type and process accordingly
        if (param.Type === 'StringList') {
            // Split the value by comma and trim whitespace from each item
            current[lastPart] = param.Value.split(',').map(item => item.trim());
        } else {
            current[lastPart] = param.Value;
        }
    });

    return result;
}
