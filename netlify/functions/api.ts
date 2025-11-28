import serverless from "serverless-http";
import { createServer } from "../../server/index";

const app = createServer();

const baseHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  // Ensure body is a string for serverless-http to parse
  if (event.body && typeof event.body !== "string") {
    event.body = JSON.stringify(event.body);
  }

  console.log(
    "[Netlify] Event body (type: " + typeof event.body + "):",
    event.body,
  );

  return baseHandler(event, context);
};
