// package ir.atlassian.jira.plugins.license;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Scanner;

/**
 * License Generator Tool
 * Run this separately to generate license keys for customers
 * 
 * Usage: java LicenseGenerator
 */
public class LicenseGenerator {

    // IMPORTANT: This must match the SECRET_KEY in LicenseManager.java
    private static final String SECRET_KEY = "PersianCalendar2024SecretKey!@#$";
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║   Persian Calendar License Generator     ║");
        System.out.println("╚══════════════════════════════════════════╝");
        System.out.println();

        // Get Server ID
        System.out.print("Enter Server ID (8 chars, e.g., A1B2C3D4): ");
        String serverId = scanner.nextLine().trim().toUpperCase();

        if (serverId.length() != 8) {
            System.out.println("Error: Server ID must be exactly 8 characters!");
            return;
        }

        // Get License Type
        System.out.print("License Type (F=Full, T=Trial): ");
        String typeInput = scanner.nextLine().trim().toUpperCase();

        if (!typeInput.equals("F") && !typeInput.equals("T")) {
            System.out.println("Error: Invalid license type!");
            return;
        }

        // Get Expiry Date
        System.out.print("Expiry Date (YYYY-MM-DD): ");
        String expiryInput = scanner.nextLine().trim();

        LocalDate expiryDate;
        try {
            expiryDate = LocalDate.parse(expiryInput);
        } catch (Exception e) {
            System.out.println("Error: Invalid date format!");
            return;
        }

        // Generate License
        String license = generateLicense(typeInput, serverId, expiryDate);

        System.out.println();
        System.out.println("════════════════════════════════════════════");
        System.out.println("Generated License Key:");
        System.out.println();
        System.out.println("  " + license);
        System.out.println();
        System.out.println("════════════════════════════════════════════");
        System.out.println("Type: " + (typeInput.equals("F") ? "Full" : "Trial"));
        System.out.println("Server ID: " + serverId);
        System.out.println("Expires: " + expiryDate);
        System.out.println("════════════════════════════════════════════");

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
            SecretKeySpec keySpec = new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
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
            return "";
        }
    }

    /**
     * Generate Server ID hash from server details
     * Use this when customer provides their server info
     */
    public static String generateServerIdHash(String jiraHome, String hostname, String osInfo) {
        try {
            String combined = jiraHome + "|" + hostname + "|" + osInfo;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(combined.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                String hex = Integer.toHexString(0xff & hash[i]);
                if (hex.length() == 1)
                    hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString().toUpperCase();
        } catch (Exception e) {
            return "00000000";
        }
    }
}
