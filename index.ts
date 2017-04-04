/**
 * This module is a Multer Engine for Azure Blog Storage
 */

import * as azure from 'azure-storage';

interface iOpts {
  account: string,
  key: string,
  connectionString: string,
  container: string,
  blobPathResolver: (req: any, file: any, cb: (error: any, blobPath: string) => void) => void,
  storageOptions?: any;
}


class Blob {
  private container: string;
  private blobSvc: azure.BlobService;
  private blobPathResolver: (req: any, file: any, cb: (error: any, blobPath: string) => void) => void;
  private storageOptions: any

  //Creates a new service to interact with azure blob storage
  constructor(opts: iOpts) {
    this.container = opts.container;
    this.blobSvc = opts.connectionString ? azure.createBlobService(opts.connectionString) : azure.createBlobService(opts.account, opts.key);
    this.createContainer(this.container);
    this.blobPathResolver = opts.blobPathResolver;
    this.storageOptions = opts.storageOptions;
    console.log('this.storageOptions:', this.storageOptions)
  };

  //This creates the container if one doesn't exist
  private createContainer(name: string) {
    this.blobSvc.createContainerIfNotExists(name, function (error, result, response) {
      if (error) {
        throw error;
      }
    });
  }

  // actual upload function, will wait for blobPathResolver callback before upload.
  private uploadToBlob(req: any, file: any, cb: any) {
    let that = this;
    return function (something: any, blobPath: string) {
      let blobStream = that.blobSvc.createWriteStreamToBlockBlob(that.container, blobPath, something, function(error){
        if(error){cb(error);}
      });
      file.stream.pipe(blobStream);
      blobStream.on("close", function(){
        let fullUrl = that.blobSvc.getUrl(that.container, blobPath);
        let fileClone = JSON.parse(JSON.stringify(file));
        fileClone.container = that.container;
        fileClone.blobPath = blobPath;
        fileClone.url = fullUrl;
        cb(null, fileClone);
      });
      blobStream.on("error", function(error){
        cb(error);
      });
    }

  }

  //Handles the files delivered from Multer and sends them to Azure Blob storage. _handleFile is a required function for multer storage engines
  public _handleFile(req: any, file: any, cb: any) {

    if (this.blobPathResolver) {
      // call blobPathResolver to resolve the blobPath
      this.blobPathResolver(req, file, this.uploadToBlob(req, file, cb));
    } else {

      //Extracts the extension for the filename
      let re = /(?:\.([^.]+))?$/;
      let ext = re.exec(file.originalname)[1];

      //Creates a unique filename based on the time and appends the extension
      let newName = Date.now() + '-' + encodeURIComponent(new Buffer(file.originalname).toString('base64')) + '.' + ext;
      this.uploadToBlob(req, file, cb)(null, newName);
    }
  }

  //Removes files for Multer when it chooses to. _removeFile is a required function for multer storage engines
  public _removeFile(req: any, file: any, cb: any) {
    this.blobSvc.deleteBlob(this.container, file.filename, cb);
  }
}


module.exports = function (opts: iOpts) {
  return new Blob(opts);
}



