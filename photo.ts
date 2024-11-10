// deno-lint-ignore-file no-explicit-any
import { format } from "https://deno.land/std@0.224.0/datetime/format.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";

async function main(_param: any, param2: any) {
  try {
    switch (param2.params.type) {
      case "tag":
        try {
          const foundFolders: object[] = [];
          const path = `./config/file/${param2.params.user}/`;
          for await (const dirEntry of Deno.readDir(path)) {
            if (dirEntry.isDirectory && dirEntry.name.indexOf("_deleted_") <= 0) {
              let countImage = 0;
              for await (const imageEntry of Deno.readDir(`${path}/${dirEntry.name}`)) {
                if (imageEntry.isFile /*&& imageEntry.name.indexOf(".jpg") >= 0*/) {
                  countImage++;
                }
              }
              foundFolders.push({
                tag: dirEntry.name,
                count: countImage,
              });
            }
          }
          return { tags: foundFolders };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "tag_create":
        try {
          const path = `./config/file/${param2.params.user}/${param2.params.tag}`;
          await Deno.mkdir(path, { recursive: true });
          return { "ok": true };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "tag_update":
        try {
          const path = `./config/file/${param2.params.user}`;
          await Deno.rename(`${path}/${param2.params.prevtag}`, `${path}/${param2.params.tag}`);
          return { "ok": true };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "tag_delete":
        try {
          const path = `./config/file/${param2.params.user}`;
          const date = new Date();
          const random = format(date, "yyyy-MM-dd_HHmmss_SSS");
          await Deno.rename(`${path}/${param2.params.tag}`, `${path}/${param2.params.tag}_deleted_${random}`);
          return { "ok": true };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "upload":
        try {
          //console.log(`param2: ${JSON.stringify(param2)}`);

          const base64String = param2.params.content;
          // Usunięcie nagłówka danych (jeśli jest obecny)

          // Konwersja Base64 na binarne dane
          //const binaryData = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
          const binaryData = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));

          const user = param2.params.user;
          const tag = param2.params.tag;
          // Zapisanie pliku na dysku
          const date = new Date();
          const random = format(date, "yyyy-MM-dd_HHmmss_SSS");
          const path = `./config/file/${user}/${tag}`;
          await Deno.mkdir(path, { recursive: true });
          const filename = `${path}/photo_${random}.jpg`;
          await Deno.writeFile(filename, binaryData);
          console.log(`Zapisano plik: ${filename}`);
        } catch (e) {
          console.log(e);
        }
        break;

      case "browse":
        try {
          const foundElements: string[] = [];
          const path = `./config/file/${param2.params.user}/${param2.params.tag}/`;
          for await (const dirEntry of Deno.readDir(path)) {
            //if (dirEntry.isDirectory && dirEntry.name.indexOf("_deleted_") <= 0) {
            const fileData = await Deno.readFile(`./config/file/${param2.params.user}/${param2.params.tag}/${dirEntry.name}`);
            //const base64String = btoa(String.fromCharCode(...fileData));
            const base64String = encodeBase64(fileData);
            foundElements.push(base64String);
          }
          return { images: foundElements };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      default:
        console.log("Błędny typ żądania " + param2.params.type);
        throw new Error("Błędny typ żądania");
    }
  } catch (e) {
    console.log(e);
    return { "ok": false, "info": "error" };
  }

  return { "ok": true, "info": "ok" };
}

export { main };
