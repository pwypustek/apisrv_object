// deno-lint-ignore-file no-explicit-any
import { format } from "https://deno.land/std@0.224.0/datetime/format.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { walk } from "https://deno.land/std@0.224.0/fs/mod.ts";
import { sessionCheck } from "./auth.ts";

async function main(_param: any, param2: any) {
  try {
    console.log(
      `photo => ${param2.params.type} => ${JSON.stringify(param2.params)}`,
    );
    if (await sessionCheck(param2.params.sessionId, param2.params.cwid)) {
      // ok
    } else {
      throw new Error("Session error");
    }
    switch (param2.params.type) {
      case "tag":
        try {
          // format nazwy tag:
          // [budżet domowy] nazwa taga
          let foundFolders: object[] = [];
          const path = `./config/file/${param2.params.user}/`;
          for await (const dirEntry of Deno.readDir(path)) {
            if (
              dirEntry.isDirectory && dirEntry.name.indexOf("_deleted_") <= 0
            ) {
              let countImage = 0;
              for await (
                const imageEntry of Deno.readDir(`${path}/${dirEntry.name}`)
              ) {
                if (
                  imageEntry.isFile /*&& imageEntry.name.indexOf(".jpg") >= 0*/
                ) {
                  countImage++;
                }
              }
              foundFolders.push({
                tag: dirEntry.name,
                count: countImage,
              });
            }
          }
          foundFolders = foundFolders.sort((a: any, b: any) =>
            a.tag.localeCompare(b.tag)
          );
          return { tags: foundFolders };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "tag_create":
        try {
          const path =
            `./config/file/${param2.params.user}/${param2.params.tag}`;
          await Deno.mkdir(path, { recursive: true });
          return { "ok": true };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "tag_update":
        try {
          const path = `./config/file/${param2.params.user}`;
          await Deno.rename(
            `${path}/${param2.params.prevtag}`,
            `${path}/${param2.params.tag}`,
          );
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
          await Deno.rename(
            `${path}/${param2.params.tag}`,
            `${path}/${param2.params.tag}_deleted_${random}`,
          );
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
          const binaryData = Uint8Array.from(
            atob(base64String),
            (c) => c.charCodeAt(0),
          );

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
          const path =
            `./config/file/${param2.params.user}/${param2.params.tag}/`;
          for await (const dirEntry of Deno.readDir(path)) {
            //if (dirEntry.isDirectory && dirEntry.name.indexOf("_deleted_") <= 0) {
            const fileData = await Deno.readFile(
              `./config/file/${param2.params.user}/${param2.params.tag}/${dirEntry.name}`,
            );
            //const base64String = btoa(String.fromCharCode(...fileData));
            const base64String = encodeBase64(fileData);
            foundElements.push(base64String);
          }
          return { images: foundElements };
        } catch (e) {
          console.log(e);
          throw new Error("Błąd upload");
        }

      case "server_ls":
        try {
          if (await sessionCheck("testt", "testtt")) {
            // const path =
            //   `/media/user/k/src/x/backend/apisrv/config/file/test2@test.com`;
            const path = `${Deno.cwd()}/config/file/test2@test.com`;
            debugger;
            const tree = await buildDirectoryTree(path);
            // await Deno.writeTextFile(
            //   `./images_file_list.json`,
            //   JSON.stringify(tree, undefined, `  `),
            // );
            return { images: tree };
          } else {
            throw new Error("Błąd session");
          }
        } catch (e) {
          console.log(e);
          throw new Error("Błąd server_ls");
        }

      case "client_ls":
        try {
          debugger;
          const username = `test2@test.com`;
          const result = await graphqlClient(`
            query {
              photo(params: { type: "server_ls", user: "${username}" })
            }
          `);

          return { ret: result };
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

interface DirectoryStructure {
  [key: string]: string[];
}

async function buildDirectoryTree(path: string): Promise<DirectoryStructure> {
  const structure: DirectoryStructure = {};

  for await (
    const entry of walk(path, {
      includeDirs: true,
      exts: [".jpg"],
      followSymlinks: false,
    })
  ) {
    const parentDir =
      entry.path.replace(path, "").split("/").filter(Boolean)[0]; // Podkatalog
    if (parentDir) {
      if (!structure[parentDir]) {
        structure[parentDir] = [];
      }
      structure[parentDir].push(entry.name); // Dodaj nazwę pliku
    }
  }

  return structure;
}

const graphqlClient = async (
  query: string,
  variables?: { email?: string; password?: string },
) => {
  // if (!config) {
  //   console.log(`Brak konfiguracji pobieram`);
  //   await fetchConfig();
  // } else {
  //   console.log(`Konfiguracja ok`);
  // }
  const config = {
    //backend: "//127.0.0.1:3001/graphql",
    backend: "https://backend.versio.pl:3001/graphql",
  };

  try {
    const response = await fetch(config.backend, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      alert(`GraphQL error`);
      throw new Error(
        `GraphQL error: ${response.status} ${response.statusText}`,
      );
    }

    const responseData = await response.json();

    if (responseData.errors) {
      console.log(`Error responseData.errors`);
      const errText = responseData.errors
        .map((error: { message: any }) => error.message)
        .join("\n");
      alert(errText);
      throw new Error(errText);
    }

    return responseData.data;
  } catch (error) {
    console.error("Error during GraphQL request:", error);
    alert("Wystąpił błąd podczas wykonywania zapytania.");
    throw error;
  }
};

export { main };
