// WebRTC-based peer-to-peer file transfer service
// Files are transferred directly between peers, server only handles signaling

export interface FileTransferProgress {
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  status: 'connecting' | 'transferring' | 'completed' | 'error';
  error?: string;
}

export class WebRTCFileTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onProgressCallback?: (progress: FileTransferProgress) => void;
  private fileToSend: File | null = null;
  private chunkSize = 16 * 1024; // 16KB chunks
  private currentChunk = 0;
  private totalChunks = 0;

  constructor() {
    // Initialize with STUN servers for NAT traversal
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
    this.peerConnection = new RTCPeerConnection(configuration);
  }

  // Initialize as sender (offering file transfer)
  async initiateTransfer(file: File, recipientSocketId: string, socket: any): Promise<void> {
    this.fileToSend = file;
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    this.currentChunk = 0;

    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Create data channel for file transfer
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
    });

    this.setupDataChannelHandlers(true);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          to: recipientSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Send offer to recipient via signaling server
    socket.emit('webrtc:offer', {
      to: recipientSocketId,
      offer: offer,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    // Wait for answer
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transfer timeout - recipient did not respond'));
      }, 30000); // 30 second timeout

      socket.once('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
        clearTimeout(timeout);
        try {
          await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.answer));
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Initialize as receiver (accepting file transfer)
  async acceptTransfer(
    offer: RTCSessionDescriptionInit,
    fileName: string,
    fileSize: number,
    socket: any,
    senderSocketId: string
  ): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    // Handle incoming data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers(false);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          to: senderSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Set remote description (offer)
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Send answer to sender
    socket.emit('webrtc:answer', {
      to: senderSocketId,
      answer: answer,
    });
  }

  private setupDataChannelHandlers(isSender: boolean) {
    if (!this.dataChannel) return;

    if (isSender) {
      // Sender: send file chunks
      this.dataChannel.onopen = () => {
        this.sendFileChunk();
      };

      this.dataChannel.onerror = (error) => {
        this.reportProgress({
          fileName: this.fileToSend?.name || 'unknown',
          bytesTransferred: 0,
          totalBytes: this.fileToSend?.size || 0,
          percentage: 0,
          status: 'error',
          error: 'Data channel error',
        });
      };
    } else {
      // Receiver: receive file chunks
      let receivedChunks: ArrayBuffer[] = [];
      let totalReceived = 0;
      let expectedFileSize = 0;
      let fileName = '';
      let mimeType = '';

      this.dataChannel.onmessage = async (event) => {
        const data = event.data;

        // First message contains file metadata
        if (typeof data === 'string') {
          try {
            const metadata = JSON.parse(data);
            expectedFileSize = metadata.fileSize;
            fileName = metadata.fileName;
            mimeType = metadata.mimeType;
            this.reportProgress({
              fileName,
              bytesTransferred: 0,
              totalBytes: expectedFileSize,
              percentage: 0,
              status: 'transferring',
            });
            return;
          } catch (e) {
            // Not JSON, treat as chunk
          }
        }

        // Receive file chunks
        if (data instanceof ArrayBuffer) {
          receivedChunks.push(data);
          totalReceived += data.byteLength;

          this.reportProgress({
            fileName,
            bytesTransferred: totalReceived,
            totalBytes: expectedFileSize,
            percentage: expectedFileSize > 0 ? (totalReceived / expectedFileSize) * 100 : 0,
            status: totalReceived >= expectedFileSize ? 'completed' : 'transferring',
          });

          // If transfer complete, download file
          if (totalReceived >= expectedFileSize && receivedChunks.length > 0) {
            const blob = new Blob(receivedChunks, { type: mimeType });
            this.downloadFile(blob, fileName);
            this.cleanup();
          }
        }
      };
    }
  }

  private async sendFileChunk() {
    if (!this.dataChannel || !this.fileToSend || this.dataChannel.readyState !== 'open') {
      return;
    }

    // Send metadata first
    if (this.currentChunk === 0) {
      const metadata = {
        fileName: this.fileToSend.name,
        fileSize: this.fileToSend.size,
        mimeType: this.fileToSend.type,
      };
      this.dataChannel.send(JSON.stringify(metadata));
    }

    // Send file chunks
    const start = this.currentChunk * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.fileToSend.size);

    if (start < this.fileToSend.size) {
      const chunk = this.fileToSend.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      this.dataChannel.send(arrayBuffer);

      this.currentChunk++;
      const bytesTransferred = Math.min(end, this.fileToSend.size);

      this.reportProgress({
        fileName: this.fileToSend.name,
        bytesTransferred,
        totalBytes: this.fileToSend.size,
        percentage: (bytesTransferred / this.fileToSend.size) * 100,
        status: bytesTransferred >= this.fileToSend.size ? 'completed' : 'transferring',
      });

      // Send next chunk if not done
      if (bytesTransferred < this.fileToSend.size) {
        // Small delay to prevent overwhelming the channel
        setTimeout(() => this.sendFileChunk(), 10);
      } else {
        this.cleanup();
      }
    }
  }

  private downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private reportProgress(progress: FileTransferProgress) {
    if (this.onProgressCallback) {
      this.onProgressCallback(progress);
    }
  }

  setProgressCallback(callback: (progress: FileTransferProgress) => void) {
    this.onProgressCallback = callback;
  }

  handleICECandidate(candidate: RTCIceCandidateInit) {
    if (this.peerConnection) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  cleanup() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.fileToSend = null;
    this.currentChunk = 0;
  }
}


