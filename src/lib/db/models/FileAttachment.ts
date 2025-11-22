import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFileAttachment extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // in bytes
  path: string; // file path on server
  uploadedBy: mongoose.Types.ObjectId;
  messageId?: mongoose.Types.ObjectId; // For message attachments
  createdAt: Date;
  // For P2P transfers, we might not store the file, just metadata
  isP2P: boolean; // true if this was a direct transfer (no server storage)
}

const FileAttachmentSchema: Schema = new Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    isP2P: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
FileAttachmentSchema.index({ messageId: 1 });
FileAttachmentSchema.index({ uploadedBy: 1 });
FileAttachmentSchema.index({ createdAt: 1 }); // For cleanup of old files

const FileAttachment: Model<IFileAttachment> =
  mongoose.models.FileAttachment || mongoose.model<IFileAttachment>('FileAttachment', FileAttachmentSchema);

export default FileAttachment;


