/**
 * Data Encryption for Sensitive Cross-Service Communication
 * End-to-end encryption, key management, secure data exchange
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Encryption algorithms
export type EncryptionAlgorithm =
  | 'aes-256-gcm'
  | 'aes-256-cbc'
  | 'chacha20-poly1305'
  | 'rsa-oaep'
  | 'hybrid';

// Key types
export type KeyType = 'symmetric' | 'asymmetric' | 'hybrid';

// Key exchange protocols
export type KeyExchangeProtocol =
  | 'diffie-hellman'
  | 'rsa'
  | 'ecdh'
  | 'x25519';

// Encryption mode
export type EncryptionMode =
  | 'encrypt'
  | 'decrypt'
  | 'sign'
  | 'verify';

// Encrypted data payload
export interface EncryptedPayload {
  algorithm: EncryptionAlgorithm;
  keyId?: string;
  iv: string;
  authTag?: string;
  ciphertext: string;
  metadata?: Record<string, any>;
}

// Encryption result
export interface EncryptionResult {
  encrypted: EncryptedPayload;
  originalSize: number;
  encryptedSize: number;
  algorithm: EncryptionAlgorithm;
  keyId?: string;
}

// Key management
export interface KeyManager {
  generateKey: (algorithm: EncryptionAlgorithm) => Promise<{ keyId: string; key: Buffer }>;
  getKey: (keyId: string) => Promise<Buffer | null>;
  storeKey: (keyId: string, key: Buffer) => Promise<void>;
  rotateKey: (keyId: string) => Promise<{ newKeyId: string; newKey: Buffer }>;
  deleteKey: (keyId: string) => Promise<void>;
}

// Encryption config
export interface EncryptionConfig {
  serviceName: string;
  defaultAlgorithm: EncryptionAlgorithm;
  keyExchangeProtocol: KeyExchangeProtocol;
  enableKeyRotation: boolean;
  keyRotationDays: number;
  enableSigning: boolean;
  signAlgorithm: string;
}

// Generate encryption config
export async function generateEncryptionConfig(
  serviceName: string,
  defaultAlgorithm: EncryptionAlgorithm = 'aes-256-gcm'
): Promise<EncryptionConfig> {
  return {
    serviceName,
    defaultAlgorithm,
    keyExchangeProtocol: 'ecdh',
    enableKeyRotation: true,
    keyRotationDays: 90,
    enableSigning: true,
    signAlgorithm: 'sha256',
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptEncryption(
  config: EncryptionConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['crypto'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-encryption.ts`,
    content: `// Data Encryption for ${config.serviceName}

import * as crypto from 'crypto';

export type EncryptionAlgorithm =
  | 'aes-256-gcm'
  | 'aes-256-cbc'
  | 'chacha20-poly1305'
  | 'rsa-oaep'
  | 'hybrid';

export type KeyType = 'symmetric' | 'asymmetric' | 'hybrid';
export type KeyExchangeProtocol = 'diffie-hellman' | 'rsa' | 'ecdh' | 'x25519';

export interface EncryptedPayload {
  algorithm: EncryptionAlgorithm;
  keyId?: string;
  iv: string;
  authTag?: string;
  ciphertext: string;
  metadata?: Record<string, any>;
}

export interface EncryptionResult {
  encrypted: EncryptedPayload;
  originalSize: number;
  encryptedSize: number;
  algorithm: EncryptionAlgorithm;
  keyId?: string;
}

export class ${toPascalCase(config.serviceName)}DataEncryption {
  private config: any;
  private keys: Map<string, Buffer>;
  private keyStore: Map<string, { key: Buffer; createdAt: Date; algorithm: EncryptionAlgorithm }>;

  constructor(config: any) {
    this.config = config;
    this.keys = new Map();
    this.keyStore = new Map();
  }

  /**
   * Generate a new encryption key
   */
  generateKey(algorithm: EncryptionAlgorithm = this.config.defaultAlgorithm): { keyId: string; key: Buffer } {
    const keyId = this.generateKeyId();
    let key: Buffer;

    switch (algorithm) {
      case 'aes-256-gcm':
      case 'aes-256-cbc':
        key = crypto.randomBytes(32); // 256 bits
        break;
      case 'chacha20-poly1305':
        key = crypto.randomBytes(32); // 256 bits
        break;
      case 'rsa-oaep':
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 4096,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        key = Buffer.from(privateKey);
        break;
      default:
        key = crypto.randomBytes(32);
    }

    this.keyStore.set(keyId, { key, createdAt: new Date(), algorithm });
    this.keys.set(keyId, key);

    return { keyId, key };
  }

  /**
   * Encrypt data
   */
  encrypt(data: string | Buffer, keyId?: string, algorithm?: EncryptionAlgorithm): EncryptionResult {
    const algo = algorithm || this.config.defaultAlgorithm;
    const { keyId: effectiveKeyId, key } = this.getEncryptionKey(keyId, algo);

    const originalSize = Buffer.byteLength(data);

    let iv: Buffer;
    let ciphertext: Buffer;
    let authTag: Buffer | undefined;

    switch (algo) {
      case 'aes-256-gcm':
        iv = crypto.randomBytes(16); // 96-bit IV for GCM
        const cipherGcm = crypto.createCipheriv(algo, key, iv);
        cipherGcm.setAAD(Buffer.from('additional-data')); // Optional AAD

        const encryptedGcm = Buffer.concat([cipherGcm.update(data), cipherGcm.final()]);
        authTag = cipherGcm.getAuthTag();
        ciphertext = encryptedGcm;
        break;

      case 'aes-256-cbc':
        iv = crypto.randomBytes(16); // 128-bit IV for CBC
        const cipherCbc = crypto.createCipheriv(algo, key, iv);
        ciphertext = Buffer.concat([cipherCbc.update(data), cipherCbc.final()]);
        break;

      case 'chacha20-poly1305':
        iv = crypto.randomBytes(12); // 96-bit nonce for ChaCha20-Poly1305
        const cipherChaCha = crypto.createCipheriv('chacha20-poly1305', key, iv);
        const encryptedChaCha = Buffer.concat([cipherChaCha.update(data), cipherChaCha.final()]);
        authTag = cipherChaCha.getAuthTag();
        ciphertext = encryptedChaCha;
        break;

      default:
        throw new Error(\`Unsupported algorithm: \${algo}\`);
    }

    const encrypted: EncryptedPayload = {
      algorithm: algo,
      keyId: effectiveKeyId,
      iv: iv.toString('base64'),
      authTag: authTag?.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      metadata: {
        encryptedAt: new Date().toISOString(),
        originalSize,
      },
    };

    return {
      encrypted,
      originalSize,
      encryptedSize: ciphertext.length,
      algorithm: algo,
      keyId: effectiveKeyId,
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encrypted: EncryptedPayload): Buffer {
    const { keyId, algorithm, iv, authTag, ciphertext } = encrypted;

    const keyEntry = this.keyStore.get(keyId!);
    if (!keyEntry) {
      throw new Error(\`Key not found: \${keyId}\`);
    }

    const key = keyEntry.key;
    const ivBuffer = Buffer.from(iv, 'base64');
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

    let decrypted: Buffer;

    switch (algorithm) {
      case 'aes-256-gcm':
        const decipherGcm = crypto.createDecipheriv(algorithm, key, ivBuffer);
        if (authTag) {
          decipherGcm.setAuthTag(Buffer.from(authTag, 'base64'));
        }
        decrypted = Buffer.concat([decipherGcm.update(ciphertextBuffer), decipherGcm.final()]);
        break;

      case 'aes-256-cbc':
        const decipherCbc = crypto.createDecipheriv(algorithm, key, ivBuffer);
        decrypted = Buffer.concat([decipherCbc.update(ciphertextBuffer), decipherCbc.final()]);
        break;

      case 'chacha20-poly1305':
        const decipherChaCha = crypto.createDecipheriv('chacha20-poly1305', key, ivBuffer);
        if (authTag) {
          decipherChaCha.setAuthTag(Buffer.from(authTag, 'base64'));
        }
        decrypted = Buffer.concat([decipherChaCha.update(ciphertextBuffer), decipherChaCha.final()]);
        break;

      default:
        throw new Error(\`Unsupported algorithm: \${algorithm}\`);
    }

    return decrypted;
  }

  /**
   * Hybrid encryption (encrypt symmetric key with asymmetric)
   */
  encryptHybrid(data: string | Buffer, publicKeyId: string): EncryptionResult {
    // Generate ephemeral symmetric key
    const { keyId: symmetricKeyId, key: symmetricKey } = this.generateKey('aes-256-gcm');

    // Encrypt data with symmetric key
    const encryptedData = this.encrypt(data, symmetricKeyId, 'aes-256-gcm');

    // Encrypt symmetric key with public key
    const publicKeyEntry = this.keyStore.get(publicKeyId);
    if (!publicKeyEntry) {
      throw new Error(\`Public key not found: \${publicKeyId}\`);
    }

    const encryptedSymmetricKey = crypto.publicEncrypt(
      {
        key: publicKeyEntry.key.toString(),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      symmetricKey
    );

    return {
      encrypted: {
        ...encryptedData.encrypted,
        keyId: publicKeyId,
        metadata: {
          ...encryptedData.encrypted.metadata,
          encryptedSymmetricKey: encryptedSymmetricKey.toString('base64'),
        },
      },
      originalSize: encryptedData.originalSize,
      encryptedSize: encryptedData.encryptedSize + encryptedSymmetricKey.length,
      algorithm: 'hybrid',
      keyId: publicKeyId,
    };
  }

  /**
   * Decrypt hybrid encrypted data
   */
  decryptHybrid(encrypted: EncryptedPayload, privateKeyId: string): Buffer {
    const privateKeyEntry = this.keyStore.get(privateKeyId);
    if (!privateKeyEntry) {
      throw new Error(\`Private key not found: \${privateKeyId}\`);
    }

    // Decrypt symmetric key with private key
    const encryptedSymmetricKey = Buffer.from(encrypted.metadata?.encryptedSymmetricKey || '', 'base64');
    const symmetricKey = crypto.privateDecrypt(
      {
        key: privateKeyEntry.key.toString(),
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedSymmetricKey
    );

    // Store ephemeral symmetric key
    const ephemeralKeyId = \`ephemeral-\${Date.now()}\`;
    this.keyStore.set(ephemeralKeyId, {
      key: symmetricKey,
      createdAt: new Date(),
      algorithm: 'aes-256-gcm',
    });

    // Decrypt data with symmetric key
    const payloadWithKeyId = { ...encrypted, keyId: ephemeralKeyId };
    return this.decrypt(payloadWithKeyId);
  }

  /**
   * Sign data
   */
  sign(data: string | Buffer, privateKeyId: string): string {
    const privateKeyEntry = this.keyStore.get(privateKeyId);
    if (!privateKeyEntry) {
      throw new Error(\`Private key not found: \${privateKeyId}\`);
    }

    const sign = crypto.createSign(this.config.signAlgorithm);
    sign.update(data);
    sign.end();

    return sign.sign(privateKeyEntry.key).toString('base64');
  }

  /**
   * Verify signature
   */
  verify(data: string | Buffer, signature: string, publicKeyId: string): boolean {
    const publicKeyEntry = this.keyStore.get(publicKeyId);
    if (!publicKeyEntry) {
      throw new Error(\`Public key not found: \${publicKeyId}\`);
    }

    const verify = crypto.createVerify(this.config.signAlgorithm);
    verify.update(data);
    verify.end();

    return verify.verify(publicKeyEntry.key, Buffer.from(signature, 'base64'));
  }

  /**
   * Generate key exchange (ECDH)
   */
  generateKeyExchange(): { publicKey: Buffer; privateKey: Buffer } {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();

    return {
      publicKey: ecdh.getPublicKey(),
      privateKey: ecdh.getPrivateKey(),
    };
  }

  /**
   * Compute shared secret
   */
  computeSharedSecret(privateKey: Buffer, publicKey: Buffer): Buffer {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privateKey);
    return ecdh.computeSecret(publicKey);
  }

  /**
   * Get encryption key
   */
  private getEncryptionKey(keyId: string | undefined, algorithm: EncryptionAlgorithm): { keyId: string; key: Buffer } {
    if (keyId && this.keys.has(keyId)) {
      return { keyId, key: this.keys.get(keyId)! };
    }

    // Generate new key if not exists
    return this.generateKey(algorithm);
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return \`key-\${Date.now()}-\${crypto.randomBytes(8).toString('hex')}\`;
  }

  /**
   * Rotate key
   */
  rotateKey(oldKeyId: string): { newKeyId: string; newKey: Buffer } {
    const oldKeyEntry = this.keyStore.get(oldKeyId);
    if (!oldKeyEntry) {
      throw new Error(\`Key not found: \${oldKeyId}\`);
    }

    // Generate new key
    const { keyId, key } = this.generateKey(oldKeyEntry.algorithm);

    // Mark old key for deletion (but keep for decryption)
    oldKeyEntry.metadata = { ...oldKeyEntry.metadata, rotatedAt: new Date(), replacedBy: keyId };

    return { newKeyId: keyId, newKey: key };
  }

  /**
   * Delete old keys
   */
  cleanupOldKeys(maxAgeDays: number = this.config.keyRotationDays): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);

    let deleted = 0;
    for (const [keyId, entry] of this.keyStore.entries()) {
      if (entry.createdAt < cutoff && entry.metadata?.rotatedAt) {
        this.keyStore.delete(keyId);
        this.keys.delete(keyId);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Export key (for backup)
   */
  exportKey(keyId: string, password?: string): string {
    const keyEntry = this.keyStore.get(keyId);
    if (!keyEntry) {
      throw new Error(\`Key not found: \${keyId}\`);
    }

    const keyData = {
      keyId,
      key: keyEntry.key.toString('base64'),
      algorithm: keyEntry.algorithm,
      createdAt: keyEntry.createdAt.toISOString(),
    };

    const jsonData = JSON.stringify(keyData);

    if (password) {
      // Encrypt exported key with password
      const cipher = crypto.createCipher('aes-256-cbc', password);
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    }

    return Buffer.from(jsonData).toString('base64');
  }

  /**
   * Import key
   */
  importKey(exportedKey: string, password?: string): string {
    let jsonData: string;

    if (password) {
      // Decrypt exported key
      const decipher = crypto.createDecipher('aes-256-cbc', password);
      let decrypted = decipher.update(exportedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      jsonData = decrypted;
    } else {
      jsonData = Buffer.from(exportedKey, 'base64').toString('utf8');
    }

    const keyData = JSON.parse(jsonData);
    const key = Buffer.from(keyData.key, 'base64');

    this.keyStore.set(keyData.keyId, {
      key,
      createdAt: new Date(keyData.createdAt),
      algorithm: keyData.algorithm,
    });
    this.keys.set(keyData.keyId, key);

    return keyData.keyId;
  }
}

// Factory function
export function createDataEncryption(config: any) {
  return new ${toPascalCase(config.serviceName)}DataEncryption(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    defaultAlgorithm: 'aes-256-gcm',
    keyExchangeProtocol: 'ecdh',
    enableKeyRotation: true,
    keyRotationDays: 90,
    enableSigning: true,
    signAlgorithm: 'sha256',
  };

  const encryption = new ${toPascalCase(config.serviceName)}DataEncryption(config);

  // Generate keys
  const { keyId } = encryption.generateKey('aes-256-gcm');
  console.log('Generated key:', keyId);

  // Encrypt data
  const sensitiveData = 'This is sensitive information';
  const encrypted = encryption.encrypt(sensitiveData, keyId);
  console.log('Encrypted:', encrypted);

  // Decrypt data
  const decrypted = encryption.decrypt(encrypted.encrypted);
  console.log('Decrypted:', decrypted.toString());

  // Generate RSA key pair for hybrid encryption
  const { keyId: rsaKeyId } = encryption.generateKey('rsa-oaep');
  const hybridEncrypted = encryption.encryptHybrid(sensitiveData, rsaKeyId);
  console.log('Hybrid encrypted:', hybridEncrypted);

  // Sign and verify
  const signature = encryption.sign(sensitiveData, rsaKeyId);
  const isValid = encryption.verify(sensitiveData, signature, rsaKeyId);
  console.log('Signature valid:', isValid);

  // Key exchange
  const alice = encryption.generateKeyExchange();
  const bob = encryption.generateKeyExchange();

  const aliceShared = encryption.computeSharedSecret(alice.privateKey, bob.publicKey);
  const bobShared = encryption.computeSharedSecret(bob.privateKey, alice.publicKey);

  console.log('Shared secrets match:', aliceShared.equals(bobShared));
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonEncryption(
  config: EncryptionConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['cryptography', 'base64'];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_data_encryption.py`,
    content: `# Data Encryption for ${config.serviceName}
import base64
import json
import time
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, ChaCha20Poly1305
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import os

class EncryptionAlgorithm(Enum):
    AES_256_GCM = 'aes-256-gcm'
    AES_256_CBC = 'aes-256-cbc'
    CHACHA20_POLY1305 = 'chacha20-poly1305'
    RSA_OAEP = 'rsa-oaep'
    HYBRID = 'hybrid'

class KeyExchangeProtocol(Enum):
    DIFFIE_HELLMAN = 'diffie-hellman'
    RSA = 'rsa'
    ECDH = 'ecdh'
    X25519 = 'x25519'

@dataclass
class EncryptedPayload:
    algorithm: str
    key_id: Optional[str]
    iv: str
    auth_tag: Optional[str]
    ciphertext: str
    metadata: Optional[Dict] = None

@dataclass
class EncryptionResult:
    encrypted: EncryptedPayload
    original_size: int
    encrypted_size: int
    algorithm: str
    key_id: Optional[str]

class ${toPascalCase(config.serviceName)}DataEncryption:
    def __init__(self, config: Dict):
        self.config = config
        self.keys: Dict[str, bytes] = {}
        self.key_store: Dict[str, Dict] = {}

    def generate_key(self, algorithm: str = None) -> Tuple[str, bytes]:
        """Generate a new encryption key"""
        algo = algorithm or self.config.get('defaultAlgorithm', 'aes-256-gcm')
        key_id = self._generate_key_id()

        if algo in ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305']:
            key = os.urandom(32)  # 256 bits
        elif algo == 'rsa-oaep':
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=4096,
                backend=default_backend()
            )
            key = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
        else:
            key = os.urandom(32)

        self.key_store[key_id] = {
            'key': key,
            'created_at': time.time(),
            'algorithm': algo
        }
        self.keys[key_id] = key

        return key_id, key

    def encrypt(self, data: bytes, key_id: str = None, algorithm: str = None) -> EncryptionResult:
        """Encrypt data"""
        algo = algorithm or self.config.get('defaultAlgorithm', 'aes-256-gcm')
        effective_key_id, key = self._get_encryption_key(key_id, algo)

        original_size = len(data)

        if algo == 'aes-256-gcm':
            aesgcm = AESGCM(key)
            nonce = os.urandom(12)  # 96-bit nonce
            ciphertext = aesgcm.encrypt(nonce, data, None)

            encrypted = EncryptedPayload(
                algorithm=algo,
                key_id=effective_key_id,
                iv=base64.b64encode(nonce).decode(),
                auth_tag=base64.b64encode(ciphertext[-16:]).decode(),
                ciphertext=base64.b64encode(ciphertext[:-16]).decode(),
                metadata={'encryptedAt': time.time(), 'originalSize': original_size}
            )

        elif algo == 'chacha20-poly1305':
            chacha = ChaCha20Poly1305(key)
            nonce = os.urandom(12)
            ciphertext = chacha.encrypt(nonce, data, None)

            encrypted = EncryptedPayload(
                algorithm=algo,
                key_id=effective_key_id,
                iv=base64.b64encode(nonce).decode(),
                auth_tag=base64.b64encode(ciphertext[-16:]).decode(),
                ciphertext=base64.b64encode(ciphertext[:-16]).decode(),
            )

        else:
            raise ValueError(f"Unsupported algorithm: {algo}")

        return EncryptionResult(
            encrypted=encrypted,
            original_size=original_size,
            encrypted_size=len(ciphertext),
            algorithm=algo,
            key_id=effective_key_id
        )

    def decrypt(self, encrypted: EncryptedPayload) -> bytes:
        """Decrypt data"""
        key_entry = self.key_store.get(encrypted.key_id)
        if not key_entry:
            raise ValueError(f"Key not found: {encrypted.key_id}")

        key = key_entry['key']
        iv = base64.b64decode(encrypted.iv)
        ciphertext = base64.b64decode(encrypted.ciphertext)

        if encrypted.algorithm == 'aes-256-gcm':
            aesgcm = AESGCM(key)
            auth_tag = base64.b64decode(encrypted.auth_tag)
            full_ciphertext = ciphertext + auth_tag
            decrypted = aesgcm.decrypt(iv, full_ciphertext, None)

        elif encrypted.algorithm == 'chacha20-poly1305':
            chacha = ChaCha20Poly1305(key)
            auth_tag = base64.b64decode(encrypted.auth_tag)
            full_ciphertext = ciphertext + auth_tag
            decrypted = chacha.decrypt(iv, full_ciphertext, None)

        else:
            raise ValueError(f"Unsupported algorithm: {encrypted.algorithm}")

        return decrypted

    def _get_encryption_key(self, key_id: Optional[str], algorithm: str) -> Tuple[str, bytes]:
        """Get encryption key, generate if not exists"""
        if key_id and key_id in self.keys:
            return key_id, self.keys[key_id]
        return self.generate_key(algorithm)

    def _generate_key_id(self) -> str:
        """Generate unique key ID"""
        return f"key-{int(time.time())}-{os.urandom(8).hex()}"

# Usage
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'defaultAlgorithm': 'aes-256-gcm',
        'keyExchangeProtocol': 'ecdh',
        'enableKeyRotation': True,
    }

    encryption = ${toPascalCase(config.serviceName)}DataEncryption(config)

    # Generate key
    key_id, _ = encryption.generate_key('aes-256-gcm')
    print(f"Generated key: {key_id}")

    # Encrypt data
    data = b"This is sensitive information"
    encrypted = encryption.encrypt(data, key_id)
    print(f"Encrypted: {encrypted}")

    # Decrypt data
    decrypted = encryption.decrypt(encrypted.encrypted)
    print(f"Decrypted: {decrypted.decode()}")

if __name__ == '__main__':
    import asyncio
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoEncryption(
  config: EncryptionConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = ['crypto/aes', 'crypto/cipher', 'crypto/rand', 'crypto/rsa', 'crypto/sha256'];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-encryption.go`,
    content: `package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"
)

type EncryptionAlgorithm string

const (
	AlgorithmAES256GCM      EncryptionAlgorithm = "aes-256-gcm"
	AlgorithmAES256CBC      EncryptionAlgorithm = "aes-256-cbc"
	AlgorithmChaCha20Poly1305 EncryptionAlgorithm = "chacha20-poly1305"
	AlgorithmRSAOAEP        EncryptionAlgorithm = "rsa-oaep"
	AlgorithmHybrid         EncryptionAlgorithm = "hybrid"
)

type KeyExchangeProtocol string

const (
	KeyExchangeDiffieHellman KeyExchangeProtocol = "diffie-hellman"
	KeyExchangeRSA          KeyExchangeProtocol = "rsa"
	KeyExchangeECDH         KeyExchangeProtocol = "ecdh"
	KeyExchangeX25519       KeyExchangeProtocol = "x25519"
)

type EncryptedPayload struct {
	Algorithm EncryptionAlgorithm         \`json:"algorithm"\`
	KeyID     string                      \`json:"keyId,omitempty"\`
	IV        string                      \`json:"iv"\`
	AuthTag   string                      \`json:"authTag,omitempty"\`
	Ciphertext string                     \`json:"ciphertext"\`
	Metadata  map[string]interface{}      \`json:"metadata,omitempty"\`
}

type EncryptionResult struct {
	Encrypted     EncryptedPayload      \`json:"encrypted"\`
	OriginalSize  int64                  \`json:"originalSize"\`
	EncryptedSize int64                  \`json:"encryptedSize"\`
	Algorithm     EncryptionAlgorithm    \`json:"algorithm"\`
	KeyID         string                 \`json:"keyId"\`
}

type KeyEntry struct {
	Key       []byte
	CreatedAt time.Time
	Algorithm EncryptionAlgorithm
}

type ${toPascalCase(config.serviceName)}DataEncryption struct {
	config   map[string]interface{}
	keys     map[string][]byte
	keyStore map[string]KeyEntry
}

func New${toPascalCase(config.serviceName)}DataEncryption(config map[string]interface{}) *${toPascalCase(config.serviceName)}DataEncryption {
	return &${toPascalCase(config.serviceName)}DataEncryption{
		config:   config,
		keys:     make(map[string][]byte),
		keyStore: make(map[string]KeyEntry),
	}
}

func (e *${toPascalCase(config.serviceName)}DataEncryption) GenerateKey(algorithm EncryptionAlgorithm) (string, []byte) {
	keyID := e.generateKeyID()
	var key []byte

	switch algorithm {
	case AlgorithmAES256GCM, AlgorithmAES256CBC, AlgorithmChaCha20Poly1305:
		key = make([]byte, 32) // 256 bits
		rand.Read(key)
	default:
		key = make([]byte, 32)
		rand.Read(key)
	}

	e.keyStore[keyID] = KeyEntry{
		Key:       key,
		CreatedAt: time.Now(),
		Algorithm: algorithm,
	}
	e.keys[keyID] = key

	return keyID, key
}

func (e *${toPascalCase(config.serviceName)}DataEncryption) Encrypt(data []byte, keyID string, algorithm EncryptionAlgorithm) EncryptionResult {
	algo := algorithm
	if algo == "" {
		algo = AlgorithmAES256GCM
	}

	effectiveKeyID, key := e.getEncryptionKey(keyID, algo)
	originalSize := int64(len(data))

	var iv []byte
	var ciphertext []byte
	var authTag []byte

	switch algo {
	case AlgorithmAES256GCM:
		iv = make([]byte, 12)
		rand.Read(iv)

		block, err := aes.NewCipher(key)
		if err != nil {
			panic(err)
		}

		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			panic(err)
		}

		ciphertext = aesgcm.Seal(nil, iv, data, nil)
		authTag = ciphertext[len(ciphertext)-16:]
		ciphertext = ciphertext[:len(ciphertext)-16]

	default:
		panic("unsupported algorithm")
	}

	encrypted := EncryptedPayload{
		Algorithm: algo,
		KeyID:     effectiveKeyID,
		IV:        base64.StdEncoding.EncodeToString(iv),
		AuthTag:   base64.StdEncoding.EncodeToString(authTag),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
		Metadata: map[string]interface{}{
			"encryptedAt":  time.Now().Format(time.RFC3339),
			"originalSize": originalSize,
		},
	}

	return EncryptionResult{
		Encrypted:     encrypted,
		OriginalSize:  originalSize,
		EncryptedSize: int64(len(ciphertext)),
		Algorithm:     algo,
		KeyID:         effectiveKeyID,
	}
}

func (e *${toPascalCase(config.serviceName)}DataEncryption) Decrypt(encrypted EncryptedPayload) ([]byte, error) {
	keyEntry, exists := e.keyStore[encrypted.KeyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", encrypted.KeyID)
	}

	key := keyEntry.Key
	iv, _ := base64.StdEncoding.DecodeString(encrypted.IV)
	ciphertext, _ := base64.StdEncoding.DecodeString(encrypted.Ciphertext)
	authTag, _ := base64.StdEncoding.DecodeString(encrypted.AuthTag)

	var decrypted []byte

	switch encrypted.Algorithm {
	case AlgorithmAES256GCM:
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, err
		}

		aesgcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}

		fullCiphertext := append(ciphertext, authTag...)
		decrypted, err = aesgcm.Open(nil, iv, fullCiphertext, nil)
		if err != nil {
			return nil, err
		}

	default:
		return nil, fmt.Errorf("unsupported algorithm: %s", encrypted.Algorithm)
	}

	return decrypted, nil
}

func (e *${toPascalCase(config.serviceName)}DataEncryption) getEncryptionKey(keyID string, algorithm EncryptionAlgorithm) (string, []byte) {
	if keyID != "" {
		if key, exists := e.keys[keyID]; exists {
			return keyID, key
		}
	}
	return e.GenerateKey(algorithm)
}

func (e *${toPascalCase(config.serviceName)}DataEncryption) generateKeyID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("key-%d-%s", time.Now().Unix(), base64.URLEncoding.EncodeToString(b))
}

func main() {
	config := map[string]interface{}{
		"serviceName":        "${config.serviceName}",
		"defaultAlgorithm":   AlgorithmAES256GCM,
		"keyExchangeProtocol": KeyExchangeECDH,
		"enableKeyRotation":  true,
	}

	encryption := New${toPascalCase(config.serviceName)}DataEncryption(config)

	// Generate key
	keyID, _ := encryption.GenerateKey(AlgorithmAES256GCM)
	fmt.Printf("Generated key: %s\\n", keyID)

	// Encrypt data
	data := []byte("This is sensitive information")
	encrypted := encryption.Encrypt(data, keyID, AlgorithmAES256GCM)
	fmt.Printf("Encrypted: %+v\\n", encrypted)

	// Decrypt data
	decrypted, err := encryption.Decrypt(encrypted.Encrypted)
	if err != nil {
		fmt.Printf("Error: %v\\n", err)
		return
	}
	fmt.Printf("Decrypted: %s\\n", string(decrypted))
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeEncryptionFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayEncryptionConfig(config: EncryptionConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n🔐 Data Encryption: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Default Algorithm:'), config.defaultAlgorithm);
  console.log(chalk.cyan('Key Exchange Protocol:'), config.keyExchangeProtocol);
  console.log(chalk.cyan('Key Rotation:'), config.enableKeyRotation ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Rotation Interval:'), `${config.keyRotationDays} days`);
  console.log(chalk.cyan('Signing:'), config.enableSigning ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Sign Algorithm:'), config.signAlgorithm);

  console.log(chalk.cyan('\n🔑 Encryption Algorithms:'));
  console.log(chalk.gray('  • aes-256-gcm - AES-GCM with 256-bit key (authenticated encryption)'));
  console.log(chalk.gray('  • aes-256-cbc - AES-CBC with 256-bit key'));
  console.log(chalk.gray('  • chacha20-poly1305 - ChaCha20-Poly1305 (fast, secure)'));
  console.log(chalk.gray('  • rsa-oaep - RSA with OAEP padding (asymmetric)'));
  console.log(chalk.gray('  • hybrid - Hybrid encryption (symmetric + asymmetric)'));

  console.log(chalk.cyan('\n🔄 Key Exchange Protocols:'));
  console.log(chalk.gray('  • diffie-hellman - Classic Diffie-Hellman'));
  console.log(chalk.gray('  • rsa - RSA-based key exchange'));
  console.log(chalk.gray('  • ecdh - Elliptic Curve Diffie-Hellman'));
  console.log(chalk.gray('  • x25519 - Modern ECDH (Curve25519)'));

  console.log(chalk.cyan('\n✨ Features:'));
  console.log(chalk.gray('  • Symmetric encryption (fast)'));
  console.log(chalk.gray('  • Asymmetric encryption (secure key exchange)'));
  console.log(chalk.gray('  • Hybrid encryption (best of both)'));
  console.log(chalk.gray('  • Digital signatures'));
  console.log(chalk.gray('  • Key rotation support'));
  console.log(chalk.gray('  • Key import/export'));
  console.log(chalk.gray('  • Shared secret computation'));

  console.log(chalk.cyan('\n🛡️  Security Features:'));
  console.log(chalk.gray('  • Authenticated encryption (AEAD)'));
  console.log(chalk.gray('  • Random IV/nonce generation'));
  console.log(chalk.gray('  • Automatic key management'));
  console.log(chalk.gray('  • Secure key cleanup'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Data Encryption Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This data encryption system provides:
- **Multiple Algorithms**: AES-256-GCM, ChaCha20-Poly1305, RSA-OAEP, hybrid
- **Key Management**: Generate, store, rotate, and delete encryption keys
- **Authenticated Encryption**: AEAD modes for tamper detection
- **Hybrid Encryption**: Combine symmetric and asymmetric encryption
- **Digital Signatures**: Sign and verify data integrity
- **Key Exchange**: ECDH, X25519 for secure key sharing
- **Key Rotation**: Automatic key rotation with configurable intervals

## Usage Examples

### Basic Encryption

\`\`\`typescript
import { ${toPascalCase(serviceName)}DataEncryption } from './${serviceName}-data-encryption';

const encryption = new ${toPascalCase(serviceName)}DataEncryption({
  serviceName: '${serviceName}',
  defaultAlgorithm: 'aes-256-gcm',
  keyExchangeProtocol: 'ecdh',
  enableKeyRotation: true,
  keyRotationDays: 90,
});

// Generate key
const { keyId } = encryption.generateKey('aes-256-gcm');

// Encrypt sensitive data
const sensitiveData = 'This is sensitive information';
const encrypted = encryption.encrypt(sensitiveData, keyId);

console.log('Encrypted:', encrypted);

// Decrypt
const decrypted = encryption.decrypt(encrypted.encrypted);
console.log('Decrypted:', decrypted.toString());
\`\`\`

### Hybrid Encryption

\`\`\`typescript
// Generate RSA key pair
const { keyId: rsaKeyId } = encryption.generateKey('rsa-oaep');

// Hybrid encryption (encrypt data key with RSA)
const hybridEncrypted = encryption.encryptHybrid(sensitiveData, rsaKeyId);

// Decrypt with private key
const decrypted = encryption.decryptHybrid(hybridEncrypted.encrypted, rsaKeyId);
\`\`\`

### Digital Signatures

\`\`\`typescript
// Sign data
const signature = encryption.sign(sensitiveData, privateKeyId);

// Verify signature
const isValid = encryption.verify(sensitiveData, signature, publicKeyId);
console.log('Signature valid:', isValid);
\`\`\`

### Key Exchange (ECDH)

\`\`\`typescript
// Alice generates key pair
const alice = encryption.generateKeyExchange();

// Bob generates key pair
const bob = encryption.generateKeyExchange();

// Compute shared secret
const aliceShared = encryption.computeSharedSecret(alice.privateKey, bob.publicKey);
const bobShared = encryption.computeSharedSecret(bob.privateKey, alice.publicKey);

console.log('Shared secrets match:', aliceShared.equals(bobShared));
\`\`\`

## Algorithm Comparison

| Algorithm | Key Size | Speed | Use Case |
|-----------|----------|-------|----------|
| aes-256-gcm | 256-bit | Fast | General use, authenticated |
| aes-256-cbc | 256-bit | Fast | Legacy compatibility |
| chacha20-poly1305 | 256-bit | Very Fast | Mobile, performance-critical |
| rsa-oaep | 4096-bit | Slow | Key exchange, hybrid |
| hybrid | Varies | Medium | Best security & performance |

## Security Best Practices

1. **Use AES-256-GCM** by default (authenticated encryption)
2. **Rotate keys regularly** (default: 90 days)
3. **Use unique IVs** for each encryption (automatic)
4. **Sign sensitive data** for non-repudiation
5. **Use hybrid encryption** for large data
6. **Export and backup keys** securely
7. **Delete old keys** after rotation

## Integration

See generated code for complete API reference and security guidelines.
`;
}
