import fs from "fs";
import path from "path";
import archiver from "archiver";

const createZipFile = (items, outputPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`Archive created with ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on("error", (err) => {
      reject(err);
    });

    archive.pipe(output);

    items.forEach((item) => {
      const itemName = path.basename(item);
      const stat = fs.statSync(item);

      if (stat.isDirectory()) {
        archive.directory(item, itemName); // zip folder
      } else {
        archive.file(item, { name: itemName }); // zip file
      }
    });

    archive.finalize().catch((err) => reject(err));
  });
};

export default createZipFile;
