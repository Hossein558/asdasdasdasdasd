import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Scanner;

/**
 * License Generator Tool (Standalone)
 * 
 * Usage:
 * cd tools
 * javac LicenseGeneratorStandalone.java
 * java LicenseGeneratorStandalone
 */
public class LicenseGeneratorStandalone {

    // IMPORTANT: This must match the key retrieval in LicenseManager.java
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Secret key retrieval.
     * Uses system property if defined (-Dpersian.calendar.secret=YOUR_KEY) or falls back to obfuscated default.
     */
    private static String getSecretKey() {
        String sysKey = System.getProperty("persian.calendar.secret");
        if (sysKey != null && !sysKey.trim().isEmpty()) {
            return sysKey.trim();
        }
        byte[] k = new byte[] {80, 101, 114, 115, 105, 97, 110, 67, 97, 108, 101, 110, 100, 97, 114, 50, 48, 50, 52, 83, 101, 99, 114, 101, 116, 75, 101, 121, 33, 64, 35, 36};
        return new String(k, StandardCharsets.UTF_8);
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println();
        System.out.println("╔══════════════════════════════════════════════════╗");
        System.out.println("║   Persian Calendar License Generator             ║");
        System.out.println("║   DesktopCenter.ir                               ║");
        System.out.println("╚══════════════════════════════════════════════════╝");
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
        String license = generateLicense(typeInput, serverId, expiryDate);

        System.out.println();
        System.out.println("════════════════════════════════════════════════════");
        System.out.println("Generated License Key:");
        System.out.println();
        System.out.println("  " + license);
        System.out.println();
        System.out.println("════════════════════════════════════════════════════");
        System.out.println("Type: " + (typeInput.equals("F") ? "Full" : "Trial"));
        System.out.println("Server ID: " + serverId);
        System.out.println("Expires: " + expiryDate);
        System.out.println("════════════════════════════════════════════════════");

        scanner.close();
    }

    public static String generateLicense(String type, String serverId, LocalDate expiryDate) {
        String expiryStr = expiryDate.format(DATE_FORMAT);
        String signature = generateSignature(type, serverId, expiryStr);
        return type + "-" + serverId + "-" + expiryStr + "-" + signature;
    }

    private static String generateSignature(String type, String serverId, String expiry) {
        try {
            String data = type + "-" + serverId + "-" + expiry;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(keySpec);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
    }
}
