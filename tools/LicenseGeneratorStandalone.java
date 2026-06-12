import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Scanner;

/**
 * Standalone License Generator Tool.
 * <p>
 * Self-contained — all crypto logic is inlined so there is no dependency on
 * a separate {@code LicenseCrypto.java} copy.  The HMAC algorithm and key
 * derivation MUST match
 * {@code src/main/java/ir/atlassian/jira/plugins/license/LicenseCrypto.java}
 * exactly.  If you change the signing algorithm in the plugin, update this
 * file as well.
 * </p>
 *
 * <pre>
 * Usage:
 *   cd tools
 *   javac LicenseGeneratorStandalone.java
 *   java  LicenseGeneratorStandalone
 * </pre>
 */
public class LicenseGeneratorStandalone {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println();
        System.out.println("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
        System.out.println("\u2551   Persian Calendar License Generator             \u2551");
        System.out.println("\u2551   DesktopCenter.ir                               \u2551");
        System.out.println("\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d");
        System.out.println();

        // Get Server ID (accept any length)
        System.out.print("Enter Server ID: ");
        String serverId = scanner.nextLine().trim().toUpperCase();

        if (serverId.isEmpty()) {
            System.out.println("Error: Server ID cannot be empty!");
            return;
        }

        // Get License Type
        System.out.print("License Type (F=Full, T=Trial): ");
        String typeInput = scanner.nextLine().trim().toUpperCase();

        if (!typeInput.equals("F") && !typeInput.equals("T")) {
            System.out.println("Error: Invalid license type! Use F or T.");
            return;
        }

        // Get Expiry Date
        System.out.print("Expiry Date (YYYY-MM-DD): ");
        String expiryInput = scanner.nextLine().trim();

        LocalDate expiryDate;
        try {
            expiryDate = LocalDate.parse(expiryInput);
        } catch (Exception e) {
            System.out.println("Error: Invalid date format! Use YYYY-MM-DD");
            return;
        }

        // Generate License
        String expiryStr = expiryDate.format(DATE_FORMAT);
        String signature = generateSignature(typeInput, serverId, expiryStr);
        String license = typeInput + "-" + serverId + "-" + expiryStr + "-" + signature;

        System.out.println();
        System.out.println("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        System.out.println("Generated License Key:");
        System.out.println();
        System.out.println("  " + license);
        System.out.println();
        System.out.println("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        System.out.println("Type: " + (typeInput.equals("F") ? "Full" : "Trial"));
        System.out.println("Server ID: " + serverId);
        System.out.println("Expires: " + expiryDate);
        System.out.println("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

        scanner.close();
    }

    // ── Inline crypto — must match LicenseCrypto.java exactly ──────────────

    /**
     * Retrieves the HMAC secret key.
     * Priority: system property → obfuscated fallback.
     */
    private static String getSecretKey() {
        String sysKey = System.getProperty("persian.calendar.secret");
        if (sysKey != null && !sysKey.trim().isEmpty()) {
            return sysKey.trim();
        }
        // Obfuscated fallback — must match LicenseCrypto.java
        byte[] k = new byte[]{
            80, 101, 114, 115, 105, 97, 110, 67, 97, 108, 101, 110, 100, 97, 114,
            50, 48, 50, 52, 83, 101, 99, 114, 101, 116, 75, 101, 121, 33, 64, 35, 36
        };
        return new String(k, StandardCharsets.UTF_8);
    }

    /**
     * Generate an 8-character uppercase HMAC-SHA256 hex signature.
     * Algorithm must match LicenseCrypto.generateSignature() exactly.
     */
    private static String generateSignature(String type, String serverHash, String expiry) {
        try {
            String data = type + "-" + serverHash + "-" + expiry;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                    getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder(8);
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return "";
        }
    }
}
