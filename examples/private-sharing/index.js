// @ts-check
const express = require("express");
const fs = require("fs");
const { getBasePath } = require("./../../utils");

// Some setup for the Express server
const app = express();
const port = 8081;

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
app.use(express.static(__dirname + '/assets'));

// If you need or want to specify different initialization options you can create the SDK like this:
// const { init } = require("@digime/digime-js-sdk");
// const { pull, establishSession, authorize } = init({ baseUrl: "https://api.digi.me/v1.5" });

// Since we do not need to specify different initialization options we will import the functions directly:
const { pull, establishSession, authorize } = require("@digime/digime-js-sdk");

// Options that we will pass to the digi.me SDK
const APP = {

    // Visit https://go.digi.me/developers/register to get your Application ID
    // Replace [PLACEHOLDER_APP_ID] with the Application ID that was provided to you by digi.me
    appId: "PLACEHOLDER_APP_ID",

    // Visit https://developers.digi.me/sample-sharing-contracts for more info on sample contracts
    // Replace test Contract ID with the Contract ID that was provided to you by digi.me
    contractId: "fJI8P5Z4cIhP3HawlXVvxWBrbyj5QkTF",

    // Put your private key file (digi-me-private.key) provided by Digi.me next to your index.js file.
    // If the file name is different please update it below.
    key: fs.readFileSync(__dirname + "/digi-me-example.key").toString(),
};

// In this route, we arUse presenting the user with an action that will take them to digi.me
app.get('/', async (req, res) => {

  // First thing to do is to establish a session by using our Application ID and Contract ID
  const session = await establishSession({
    applicationId: APP.appId, 
    contractId: APP.contractId
  });

  /*
    * Once the session is established we have two options here:
    * we can pass the Application ID, session and a callback URL
    * to the "getAppUrl" to get a link to which you will need to direct the user to.
    * or we pass the session and a callback URL
    * to the "getWebURL" to get a web link to which you will need to direct the user to.
    *
    * With regards to the callback URL:
    *
    * The route for it is created later on in this file.
    * You should probably lock this down in your own production code,
    * but for demonstation purposes we're just blindly using the hostname from the request,
    * which you probably shouldn't do.
    *
    * We're also passing in the session key, so that we know what session to retrieve the data from
    * when the user returns from Digi.me. You can make this URL contain any additional info you want,
    * for example, the users ID in your system, or something like that.
    *
    * When the Digi.me flow is complete, the user will be directed to this URL, with one of the following
    * added to the query string:
    *
    * - result=DATA_READY (User has approved our request, and data is available to be retrieved)
    * - result=CANCELLED (User has denied our request)
    *
    */
   
  const webUrl = authorize.once.getPrivateShareAsGuestUrl({
      session,
      callbackUrl: `${getBasePath(req)}/return?sessionId=${session.sessionKey}`
  });

  const appUrl = authorize.once.getPrivateShareConsentUrl({
      applicationId: APP.appId,
      session,
      callbackUrl: `${getBasePath(req)}/return?sessionId=${session.sessionKey}`
  });

  // Present the generated URL with a pretty template
  res.render("pages/index", { webUrl, appUrl });
});

// Here we are creating the return path, that was mentioned earlier and was passed to the `getAppURL` function.
app.get("/return", (req, res) => {

    // This is the result of private sharing request that was sent to Digi.me
    const result = req.query.result;

    // If we did not get the response that the private sharing was APPROVED, there's not much we can do,
    // so we're just gonna stop and show an sad error page. :(
    if (result !== "SUCCESS") {
        res.render("pages/error");
        return;
    }

    // If we get do get the information that the private sharing request was APPROVED,
    // the data is ready to be retrieved and consumed!

    // Here, we're using `getSessionData` to retrieve the data from digi.me API,
    // by using the Session ID and the private key.
    //
    // Additionally, we're passing in the function that will receive data from the retrieved files.
    // This function serves as a callback function that will be called for each file, with the decrypted data,
    // after it was retrieved and decrypted with your key.
    const {filePromise} = pull.getSessionData({
        sessionKey: req.query.sessionId.toString(), // Our Session ID that we retrieved from the URL
        privateKey: APP.key, // The private key we setup above
        onFileData: ({fileData, fileName, fileMetadata}) => {
            // This is where you deal with any data you receive from digi.me,
            // in this case, we're just printing it out to the console.
            // You probably have a better idea on what to do with it! :)

            const data = JSON.parse(fileData.toString("utf8"));

            console.log("============================================================================");
            console.log("Retrieved: ", fileName);
            console.log("============================================================================");
            console.log("Metadata:\n", JSON.stringify(fileMetadata, null, 2));
            console.log("Content:\n", JSON.stringify(data, null, 2));
            console.log("============================================================================");
        },
        onFileError: ({fileName, error}) => {
            console.log("============================================================================");
            console.log(`Error retrieving file ${fileName}: ${error.toString()}`);
            console.log("============================================================================");
        },
      });

    // `getSessionData` returns a promise that will resolve once every file was processed.
    filePromise.then(() => {
        console.log("============================================================================");
        console.log("Data fetching complete.");
        console.log("============================================================================");
        // And we're just presenting a nice page here, thanking the user for their data!
        res.render("pages/return");
    });
});

app.listen(port, () => {
    console.log([
        "Example app now running on:",
        `- http://localhost:${port}`,
        `- http://${require("ip").address()}:${port} (probably)`,
    ].join("\n"));
});
