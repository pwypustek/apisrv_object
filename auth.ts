// deno-lint-ignore-file no-explicit-any
import * as modCrypto from "https://deno.land/std@0.211.0/crypto/mod.ts";
import passwordGenerator from "npm:password-generator";
import { format } from "https://deno.land/std@0.224.0/datetime/format.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import currConJSON from "../apisrv/config.ts";

currConJSON.sessionDir = currConJSON.sessionDir || "./config/session";
currConJSON.userDir = currConJSON.userDir || "./config/user";

async function main(_param: any, param2: any) {
  try {
    console.log(`param2: ${JSON.stringify(param2)}`);

    for (const value of ["./config/user", "./config/session", "./config/file"]) {
      await Deno.mkdir(value, { recursive: true });
    }

    switch (param2.params.type) {
      case "login":
        try {
          await Deno.lstat(currConJSON.userDir + "/" + param2.params.user + ".json");
          console.log("exists!");

          const userContents = await Deno.readTextFile(currConJSON.userDir + "/" + param2.params.user + ".json");
          const userJSON = JSON.parse(userContents);

          const hashNew = await hash({ "password": param2.params.pass }, { "withHash": false });
          console.log(hashNew);

          if (userJSON.hash === hashNew) {
            const { error: error, sessionId: sessionId } = await sessionCreate(param2.params);
            if (error) {
              alert(error);
              return { "ok": false, "info": "notok" };
            } else {
              return { "ok": true, "info": "ok", "sessionId": sessionId };
            }
          } else {
            return { "ok": false, "info": "Błąd logowania" };
          }
        } catch (err) {
          console.log(err);
          return { "ok": false, "info": "Login error" };
        }

      case "session":
        try {
          await Deno.lstat(currConJSON.sessionDir + "/" + param2.params.sessionId + "." + param2.params.cwid + "/session.json");
          console.log("exists!");
          const sessionContents = await Deno.readTextFile(currConJSON.sessionDir + "/" + param2.params.sessionId + "." + param2.params.cwid + "/session.json");
          const sessionContentsJSON = JSON.parse(sessionContents);
          return { "ok": true, user: sessionContentsJSON.user };
        } catch (err) {
          console.log(err);
          return { "ok": false, "info": "Session not exists" };
        }

      case "logout":
        try {
          await Deno.rename(currConJSON.sessionDir + "/" + param2.params.sessionId + "." + param2.params.cwid, currConJSON.sessionDir + "/" + param2.params.sessionId + "." + param2.params.cwid + ".inactive");
        } catch (err) {
          console.log(err);
          return { "ok": false, "info": "Logout error" };
        }
        return { "ok": true };
        
      case "register":
        try {
          if (param2.params.passNew) {
            // ok
          } else {
            throw new Error("Register error");
          }
          const hashNew = await hash({ "password": param2.params.passNew }, { "withHash": false });
          console.log(hashNew);

          const user = {
            hash: hashNew,
          };

          await Deno.writeTextFile(`${currConJSON.userDir}/${param2.params.user}.json`, JSON.stringify(user, undefined, "  "), { createNew: true });

          // utworzenie domyślnych tagów
          const path = `./config/file/${param2.params.user}/`;
          await Deno.mkdir(`${path}/Faktury firma`, { recursive: true });
          await Deno.mkdir(`${path}/Zakupy domowe`, { recursive: true });

          const { error: error, sessionId: sessionId } = await sessionCreate(param2.params);
          if (error) {
            console.log(error);
            return { "ok": false, "info": "notok" };
          } else {
            return { "ok": true, "info": "ok", "sessionId": sessionId };
          }
        } catch (e) {
          console.log(e);
          return { "ok": false, "info": "Register error" };
        }

      case "forgot":
        try {
          const passNew = passwordGenerator();
          console.log(`passNew ${passNew}`);
          const hashNew = await hash({ "password": passNew }, { "withHash": false });

          const userJson = JSON.parse(await Deno.readTextFile(`${currConJSON.userDir}/${param2.params.user}.json`));
          userJson.hash = hashNew;

          const time = format(new Date(), "yyyy-MM-dd_HHmmss_SSS");
          const pathLog = `./log/update_log/`;
          await Deno.mkdir(pathLog, { recursive: true });
          await Deno.rename(`${currConJSON.userDir}/${param2.params.user}.json`, `${pathLog}/user_update_${param2.params.user}_${time}.json`);

          await Deno.writeTextFile(`${currConJSON.userDir}/${param2.params.user}.json`, JSON.stringify(userJson, undefined, "  "));

          const text = `Login: ${param2.params.user}\nNowe hasło: ${passNew}`;
          const client = new SMTPClient({
            connection: {
              hostname: currConJSON.instance.phototag.sender.host,
              port: 465,
              tls: true,
              auth: {
                username: currConJSON.instance.phototag.sender.name,
                password: currConJSON.instance.phototag.sender.pass,
              },
            },
          });

          await client.send({
            from: currConJSON.instance.phototag.sender.name,
            to: param2.params.user,
            subject: "photoTag: Hasło zostało zresetowane",
            content: text,
          });

          await client.close();

          return { "ok": true, "info": "ok" };
        } catch (e) {
          console.log(e);
          return { "ok": false, "info": "Retrieve login error" };
        }

      default:
        throw new Error("Błąd typu auth");
    }
  } catch (e) {
    console.log(e);
    return { "error": true, "info": "error" };
  }
}

async function sessionCreate(params: { cwid: any; user: any; l10n: any; wrkst: any }) {
  try {
    const sessionId = crypto.randomUUID();
    console.log("Random UUID:", sessionId);

    await Deno.mkdir(currConJSON.sessionDir + "/" + sessionId + "." + params.cwid, { recursive: true });

    const userFileContents = {
      "user": params.user,
      "l10n": params.l10n,
      "wrkst": params.wrkst,
    };
    await Deno.writeTextFile(currConJSON.sessionDir + "/" + sessionId + "." + params.cwid + "/session.json", JSON.stringify(userFileContents, null, "\t"));
    return { sessionId: sessionId };
  } catch (err) {
    console.log(err);
    return { error: "Error create session" };
  }
}

async function sessionCheck(sessionId: string, cwid: string): Promise<boolean> {
  try {
    await Deno.lstat(
      currConJSON.sessionDir + "/" + sessionId + "." +
        cwid + "/session.json",
    );
    console.log("exists!");

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function hash(requestParams: any, _options: any) {
  let h;
  let data, hashArray, hashHex, encoder;

  data = requestParams.password + "pwm4898DJ1";
  encoder = new TextEncoder();
  data = encoder.encode(data);
  h = await modCrypto.crypto.subtle.digest("SHA-512", data);
  hashArray = Array.from(new Uint8Array(h));
  hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  data = hashHex + "KarmenkaMiOl";
  encoder = new TextEncoder();
  data = encoder.encode(data);
  h = await modCrypto.crypto.subtle.digest("SHA-512", data);
  hashArray = Array.from(new Uint8Array(h));
  hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export { main, sessionCheck };
