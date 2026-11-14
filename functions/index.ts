import { handle as handleAwsLambda } from 'hono/aws-lambda';
import serverPromise from '../build/server/index.js';

let appInstance: any;

async function getApp() {
  if (!appInstance) {
    appInstance = await serverPromise;
  }
  return appInstance;
}

// Universal handler supporting both AWS Lambda event format (Netlify BufferedInvokeProcessor)
// and standard Web Request / Response format (Netlify v2)
export const handler = async (eventOrReq: any, context: any) => {
  const app = await getApp();

  // If invoked with a standard Web Request (Netlify Functions v2 / Edge / Fetch)
  if (eventOrReq && typeof eventOrReq.url === 'string' && typeof eventOrReq.headers?.get === 'function') {
    return app.fetch(eventOrReq, { context });
  }

  // AWS Lambda event format (Netlify BufferedInvokeProcessor)
  const awsHandler = handleAwsLambda(app);
  return awsHandler(eventOrReq, context);
};

export default handler;
