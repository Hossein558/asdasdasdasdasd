// package ir.atlassian.jira.plugins.license;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
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

    // Crypto is delegated to LicenseCrypto.java (tools/) which mirrors
    // src/main/java/.../license/LicenseCrypto.java — the single source of truth.
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");


    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║   Persian Calendar License Generator     ║");
        System.out.println("╚══════════════════════════════════════════╝");
        System.out.println();

        // Get Server ID
        System.out.print("Enter Server ID (e.g., BPT3-4S1P-7QGE-5M9S): ");
        String serverId = scanner.nextLine().trim().toUpperCase();

        if (serverId.isEmpty()) {
            System.out.println("Error: Server ID cannot be empty!");
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
        return LicenseCrypto.generateSignature(type, serverId, expiry);
    }


}
