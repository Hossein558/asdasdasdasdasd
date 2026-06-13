import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Scanner;

/**
 * Standalone License Generator Tool (RSA-based).
 * 
 * Usage:
 *   java LicenseGeneratorStandalone [path_to_private_key.pem]
 */
public class LicenseGeneratorStandalone {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static PrivateKey privateKey = null;

    public static void main(String[] args) {
        String keyPath = args.length > 0 ? args[0] : "private_key.pem";

        if (!loadPrivateKey(keyPath)) {
            System.err.println("Failed to load private key from: " + keyPath);
            System.err.println("Please specify the path as an argument if it's not in the current directory.");
            return;
        }

        Scanner scanner = new Scanner(System.in);

        System.out.println();
        System.out.println("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
        System.out.println("\u2551   Persian Calendar RSA License Generator         \u2551");
        System.out.println("\u2551   DesktopCenter.ir                               \u2551");
        System.out.println("\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d");
        System.out.println();

        System.out.print("Enter Server ID: ");
        String serverId = scanner.nextLine().trim().toUpperCase();
        if (serverId.isEmpty()) {
            System.out.println("Error: Server ID cannot be empty!");
            return;
        }

        System.out.print("License Type (F=Full, T=Trial): ");
        String typeInput = scanner.nextLine().trim().toUpperCase();
        if (!typeInput.equals("F") && !typeInput.equals("T")) {
            System.out.println("Error: Invalid license type! Use F or T.");
            return;
        }

        System.out.print("Expiry Date (YYYY-MM-DD): ");
        String expiryInput = scanner.nextLine().trim();

        LocalDate expiryDate;
        try {
            expiryDate = LocalDate.parse(expiryInput);
        } catch (Exception e) {
            System.out.println("Error: Invalid date format! Use YYYY-MM-DD");
            return;
        }

        String expiryStr = expiryDate.format(DATE_FORMAT);
        String serverHash = serverId;

        String payload = typeInput + "-" + serverHash + "-" + expiryStr;
        String signature = generateHexSignature(payload);
        
        if (signature == null) {
            System.out.println("Error: Failed to generate signature.");
            return;
        }

        String license = payload + "-" + signature;

        System.out.println("\nGenerated License Key:\n");
        System.out.println(license);
        System.out.println("\nType: " + (typeInput.equals("F") ? "Full" : "Trial"));
        System.out.println("Server ID: " + serverId);
        System.out.println("Expires: " + expiryDate);

        scanner.close();
    }

    private static boolean loadPrivateKey(String path) {
        try {
            String keyStr = new String(Files.readAllBytes(Paths.get(path)));
            keyStr = keyStr.replace("-----BEGIN PRIVATE KEY-----", "")
                           .replace("-----END PRIVATE KEY-----", "")
                           .replaceAll("\\s+", "");
            byte[] keyBytes = Base64.getDecoder().decode(keyStr);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            privateKey = kf.generatePrivate(spec);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String generateHexSignature(String payload) {
        try {
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initSign(privateKey);
            sig.update(payload.getBytes("UTF-8"));
            byte[] signatureBytes = sig.sign();
            
            // Convert to Hex
            StringBuilder hexString = new StringBuilder();
            for (byte b : signatureBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return null;
        }
    }

    private static String hashServerId(String serverId) {
        if (serverId != null && serverId.matches("^[0-9A-Fa-f]{64}$")) {
            return serverId.toUpperCase();
        }
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(serverId.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return null;
        }
    }
}
