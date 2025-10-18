const GenerateZipFileName = () => {
    const dateData = new Date();
    const fixDate = `${dateData.getDate()}-${
      dateData.getMonth() + 1
    }-${dateData.getFullYear()}`;
    const fixTime = `${dateData.getHours()}:${dateData.getMinutes()}:${dateData.getSeconds()}`;
    const fileName = `${fixDate}-${fixTime}-backup`;
    return fileName;
  };
  
  export default GenerateZipFileName;
  