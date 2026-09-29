import CryptoKit
import Foundation

/// Per-archive password: HKDF-SHA256(masterKey, salt, "<resource id>\n<plain archive SHA-256>").
/// Publication derives the same password (ADR-0065); keep both implementations in sync.
enum ArchivePassword {
  private static let salt = Data("bible-strong-offline-archive".utf8)

  static func derive(masterKey: [UInt8], resourceId: String, archiveSha256: String) -> String? {
    guard !resourceId.isEmpty, isLowercaseSha256(archiveSha256) else { return nil }
    let key = HKDF<SHA256>.deriveKey(
      inputKeyMaterial: SymmetricKey(data: masterKey),
      salt: salt,
      info: Data("\(resourceId)\n\(archiveSha256)".utf8),
      outputByteCount: 32
    )
    return key.withUnsafeBytes { bytes in bytes.map { String(format: "%02x", $0) }.joined() }
  }

  private static func isLowercaseSha256(_ value: String) -> Bool {
    value.utf8.count == 64 && value.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
  }
}
