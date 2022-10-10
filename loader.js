// Discord requires a authorization token to send messages.
// We will fetch this token by listening to request discord makes
let authTokenObtained = false;
let insideChannelRequest = false;
let authToken = "";
let xsuperToken = "";
let message_send = false;

let testPrivateKey = null;
let testPublicKey = null;

function strip(html) {
  let doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

async function injectGui() {
  document.querySelectorAll("[class^=form-]").forEach((test) => {
    var label = document.createElement("label");
    label.innerText = "enable:";
    label.style.color = "#ccc";
    test.appendChild(label);

    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = "isActive";
    input.style.marginBottom = "10px";
    test.appendChild(input);
    test.appendChild(document.createElement("br"));

    var label = document.createElement("label");
    label.innerText = "private key:";
    label.style.color = "#ccc";
    test.appendChild(label);

    var input = document.createElement("textarea");
    input.id = "privateKeyInput";
    input.style.width = "100%";
    input.style.height = "100px";
    input.style.backgroundColor = "#292b2f";
    input.style.color = "#ccc";
    input.style.borderStyle = "none";
    input.value = testPrivateKey;
    input.style.marginBottom = "10px";
    test.appendChild(input);

    var label = document.createElement("label");
    label.innerText = "public key:";
    label.style.color = "#ccc";
    test.appendChild(label);

    var input = document.createElement("textarea");
    input.id = "publicKeyInput";
    input.style.width = "100%";
    input.style.height = "100px";
    input.style.backgroundColor = "#292b2f";
    input.style.color = "#ccc";
    input.style.borderStyle = "none";
    input.value = testPublicKey;
    input.style.marginBottom = "10px";
    test.appendChild(input);
  });
}
async function generateKeys() {
  const key = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [{
      name: "discordpgp",
      email: "test@example.com",
    }],
    passphrase: "",
  });

  testPrivateKey = key.privateKey;
  testPublicKey = key.publicKey;
  // document.querySelectorAll("[aria-label^=Benutzerbereich]").forEach((test) => {
  injectGui();
}

generateKeys();

// hacky af
guiNeedsToBeInjected = false; 
window.history.pushState = new Proxy(window.history.pushState, {
  apply: (target, thisArg, argArray) => {
    console.log("=> history change");
    // delay(100).then(() => injectGui());
    guiNeedsToBeInjected = true; 
    console.log(window.location);
    return target.apply(thisArg, argArray);
  },
});

var nativeIdleCallback = window.requestIdleCallback;
window.requestIdleCallback = function () {
  console.log("=> idle callback fired");
  if (guiNeedsToBeInjected) {
    injectGui();
    guiNeedsToBeInjected = false; 
  }
  return nativeIdleCallback.apply(this, [].slice.call(arguments));
};


var proxied3 = window.XMLHttpRequest.prototype.send;
window.XMLHttpRequest.prototype.send = async function () {
  // TODO: replace try catch
  try {
    // arguments[0] is message text
    let result = JSON.parse(arguments[0]);

    console.log("=> message send hook");
    console.log("ORIGINAL CONTENT =>" + result.content);

    // generate pgp keys and encrypt message
    // TODO remote this shit, just for testing
    if (document.getElementById("isActive").checked) {
      async function encryptWithPublicKey() {
        const publicKeyObj = await openpgp.readKey({
          // armoredKey: testPublicKey
          armoredKey: document.getElementById("publicKeyInput").value,
        });

        const encrypted = await openpgp.encrypt({
          // message: await openpgp.createMessage({ text: "Hello, World!" }),
          message: await openpgp.createMessage({ text: result.content }),
          encryptionKeys: publicKeyObj,
          // signingKeys: privateKeyObj,
        });

        return encrypted;
      }

      await encryptWithPublicKey().then((value) => {
        result.content = "```" + value + "```";
        console.log("NEW CONTENT=>\n" + result.content);
      });
    }

    arguments[0] = JSON.stringify(result);
  } catch {
    // pass;
    // TODO
  }
  // return proxy with new message
  return proxied3.apply(this, [].slice.call(arguments));
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function decrypt_chat() {
  let matches = [];
  // TODO i hate this, cant be right
  document.querySelectorAll("[id^=message-content]").forEach((test) => {
    console.log(test);
    matches.push(test);
  });

  for (let match of matches) {
    console.log(match);
    console.log("DECRYPT => " + match.textContent);
    try {
      const message = await openpgp.readMessage({
        armoredMessage: match.textContent,
      });
      const privateKeyObj = await openpgp.readKey({
        // armoredKey: testPrivateKey,
        armoredKey: document.getElementById("privateKeyInput").value,
      });
      const { data: decrypted } = await openpgp.decrypt({
        message,
        // verificationKeys: testPublicKey, // optional
        decryptionKeys: privateKeyObj,
      });
      match.innerHTML = strip(decrypted);
      match.style.color = "#9ec49f";
      console.log(decrypted); // 'Hello, World!'
    } catch (error) {
      console.log(error);
      // if (error.message.includes("Session key decryption failed")) {
      //   match.style.color = "#c49ea0";
      // }
    }
  }
}

async function decrypt(message_id) {
  // let match = null;
  let match = document.getElementById("message-content-" + message_id);

  console.log("DECRYPT => " + match.textContent);
  try {
    const message = await openpgp.readMessage({
      armoredMessage: match.textContent,
    });
    const privateKeyObj = await openpgp.readKey({
      // armoredKey: testPrivateKey,
      armoredKey: document.getElementById("privateKeyInput").value,
    });
    const { data: decrypted } = await openpgp.decrypt({
      message,
      // verificationKeys: testPublicKey, // optional
      decryptionKeys: privateKeyObj,
    });

    match.innerHTML = strip(decrypted);
    console.log(strip(decrypted));
    match.style.color = "#9ec49f";
    console.log(decrypted); // 'Hello, World!'
  } catch (error) {
    console.log(error);
    // if (error.message.includes("Session key decryption failed")) {
    //   match.style.color = "#c49ea0";
    // }
  }
}

// We override the default AJAX request to listen to the requests discord makes.
var proxied1 = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function () {
  if (arguments[1].startsWith("https://discord.com/api/v9/channels/")) {
    // if(arguments[1].startsWith('https://discordapp.com/api/v9/channels')){
    if (!authTokenObtained) {
      insideChannelRequest = true;
    }
    (function (url) {
      setTimeout(function () { // wait for the ui to update.
        let elements = document.getElementsByTagName("h3");
        // We update the UI to display the channel name.
        if (elements.length >= 1 && elements[0].style.userSelect !== "text") { // add channel URL to name
          elements[0].style.userSelect = "text";
          // elements[0].innerHTML += " | "+url.substring("https://discordapp.com/api/v9/channels".length);
          elements[0].innerHTML += " | " + "pwned discord";
        }
      }, 1000);
    })(arguments[1]);
  }
  return proxied1.apply(this, [].slice.call(arguments));
};

let proxied2 = window.XMLHttpRequest.prototype.setRequestHeader;
window.XMLHttpRequest.prototype.setRequestHeader = function () {
  if (
    insideChannelRequest && !authTokenObtained &&
    arguments[0] === "Authorization"
  ) {
    authToken = arguments[1];
    authToken = (webpackChunkdiscord_app.push([[""], {}, (e) => {
      m = [];
      for (let c in e.c) m.push(e.c[c]);
    }]),
      m).find((m) => m?.exports?.default?.getToken !== void 0).exports.default
      .getToken();

    authTokenObtained = true;
  }
  if (insideChannelRequest && arguments[0] == "X-Super-Properties") {
    xsuperToken = arguments[1];
    xsuperToken = (webpackChunkdiscord_app.push([[""], {}, (e) => {
      m = [];
      for (let c in e.c) m.push(e.c[c]);
    }]),
      m).find((m) => m?.exports?.default?.getToken !== void 0).exports.default
      .getToken();
  }
  return proxied2.apply(this, [].slice.call(arguments));
};

function websocketMagic() {
  let socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");

  socket.onopen = function (e) {
    window.setInterval(function () {
      var heartbeat = {
        "op": 1,
        "d": 2,
      };
      socket.send(JSON.stringify(heartbeat));
    }, 30000);

    discordToken = (webpackChunkdiscord_app.push([[""], {}, (e) => {
      m = [];
      for (let c in e.c) m.push(e.c[c]);
    }]),
      m).find((m) => m?.exports?.default?.getToken !== void 0).exports.default
      .getToken();

    var identify = {
      "op": 2,
      "d": {
        "token": discordToken,
        "intents": 513,
        "properties": {
          "os": "linux",
          "browser": "my_library",
          "device": "my_library",
        },
      },
    };

    socket.send(JSON.stringify(identify));
    console.log(JSON.stringify(identify));
  };

  socket.onmessage = function (event) {
    result = JSON.parse(event.data);
    console.log(result);

    try {
      console.log(result["d"]);
      message_content = result["d"]["content"];
      console.log("socket" + message_content);

      if (message_content.startsWith("```-----BEGIN PGP")) {
        console.log("calling decrypt on " + result["d"]["id"]);

        delay(100).then(() => {
          decrypt(result["d"]["id"]);
        });
      }
    } catch {
      // TODO
    }
  };

  socket.onclose = function (event) {
    if (event.wasClean) {
      console.log(
        `[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`,
      );
    } else {
      console.log("[close] Connection died");
    }
  };

  socket.onerror = function (error) {
    alert(`[error] ${error.message}`);
  };
}

// // We can now define a sendMessage function that behaves exactly like discord:
// function sendMessage(msg, channel) {
//   if (!authTokenObtained) {
//     console.log("Unable to send message without authToken.");
//     console.log("Try typing something in a chat to obtain the token.");
//   }
//   // channel_url = `https://discordapp.com/api/v9/channels/${channel}/messages`;
//   channel_url = `https://discord.com/api/v9/channels/${channel}/messages`;
//
//   authToken = (webpackChunkdiscord_app.push([[""], {}, (e) => {
//     m = [];
//     for (let c in e.c) m.push(e.c[c]);
//   }]),
//     m).find((m) => m?.exports?.default?.getToken !== void 0).exports.default
//     .getToken();
//
//   request = new XMLHttpRequest();
//   request.withCredentials = true;
//   request.open("POST", channel_url);
//   request.setRequestHeader("Content-Type", "application/json");
//   request.setRequestHeader("Authorization", authToken);
//   request.setRequestHeader("X-Super-Properties", xsuperToken);
//   request.send(JSON.stringify({ content: msg, tts: false }));
//
//
function modChatBox() {
  // let searchString = '[class^="channelTextArea"]';
  // document.querySelectorAll(searchString).forEach((test) => {
  // var element = document.querySelector('[aria-label="Benutzerbereich"]');
  parter_public_key = `
      <input type="text" id="user_enc_key" placeholder="partner public key"></input>
    `;

  user_public_key = `
      <input type="text" id="user_enc_key" placeholder="your public key"></input>
    `;

  user_private_key = `
      <input type="text" id="user_enc_key" placeholder="your private key"></input>
    `;
  // element.outerHTML = element.outerHTML + user_private_key;
  // document.body.appendChild(user_private_key);
  // test.innerHTML = test.innerHTML + parter_public_key + user_public_key + user_public_key;
  // });
}

function start() {
  console.log(
    "%cStarting Discord Crypt",
    "color: yellow; font-size: 35px; background-color: red;",
  );
  websocketMagic();
}

delay(1000).then(() => start());
