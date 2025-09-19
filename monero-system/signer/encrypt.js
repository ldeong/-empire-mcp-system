// encrypt.js - AES-256-GCM encryption utilities for secure wallet storage
const crypto = require('crypto');

class SecureEncryption {
    constructor(masterKey) {
        // Ensure master key is 32 bytes for AES-256
        this.masterKey = crypto.scryptSync(masterKey, 'empire-salt', 32);
    }

    encrypt(text) {
        try {
            const iv = crypto.randomBytes(12); // 96-bit IV for GCM
            const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
            
            const encrypted = Buffer.concat([
                cipher.update(text, 'utf8'),
                cipher.final()
            ]);
            
            const tag = cipher.getAuthTag();
            
            return {
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                data: encrypted.toString('hex'),
                algorithm: 'aes-256-gcm'
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    decrypt(encryptedData) {
        try {
            const { iv, tag, data } = encryptedData;
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(iv, 'hex'));
            decipher.setAuthTag(Buffer.from(tag, 'hex'));
            
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(data, 'hex')),
                decipher.final()
            ]);
            
            return decrypted.toString('utf8');
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    // Secure key derivation for different purposes
    deriveKey(purpose, salt = 'empire-key-derivation') {
        return crypto.scryptSync(this.masterKey.toString('hex') + purpose, salt, 32);
    }

    // Generate secure random tokens
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // HMAC for API request signing
    signRequest(data, secret = null) {
        const key = secret || this.masterKey;
        return crypto.createHmac('sha256', key).update(data).digest('hex');
    }

    verifySignature(data, signature, secret = null) {
        const key = secret || this.masterKey;
        const expectedSignature = crypto.createHmac('sha256', key).update(data).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
}

module.exports = { SecureEncryption };