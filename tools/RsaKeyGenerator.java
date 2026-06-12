import java.io.FileOutputStream;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Base64;

/**
 * Utility tool to generate an RSA 2048-bit key pair.
 * 
 * Run this once to generate the keys. The public_key.pem will be embedded in
 * LicenseCrypto.java, and private_key.pem will be used by LicenseGeneratorStandalone.
 * 
 * Usage:
 *   cd tools
 *   javac RsaKeyGenerator.java
 *   java RsaKeyGenerator
 */
public class RsaKeyGenerator {
    public static void main(String[] args) throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        KeyPair kp = kpg.generateKeyPair();
        
        PublicKey pub = kp.getPublic();
        PrivateKey pvt = kp.getPrivate();
        
        String outFilePub = "public_key.pem";
        String outFilePvt = "private_key.pem";

        try (FileOutputStream out = new FileOutputStream(outFilePub)) {
            out.write("-----BEGIN PUBLIC KEY-----\n".getBytes());
            out.write(Base64.getMimeEncoder(64, new byte[]{'\n'}).encode(pub.getEncoded()));
            out.write("\n-----END PUBLIC KEY-----\n".getBytes());
        }

        try (FileOutputStream out = new FileOutputStream(outFilePvt)) {
            out.write("-----BEGIN PRIVATE KEY-----\n".getBytes());
            out.write(Base64.getMimeEncoder(64, new byte[]{'\n'}).encode(pvt.getEncoded()));
            out.write("\n-----END PRIVATE KEY-----\n".getBytes());
        }

        System.out.println("Keys generated successfully:");
        System.out.println("- " + outFilePub + " (Embed in LicenseCrypto.java)");
        System.out.println("- " + outFilePvt + " (Keep this secret! Used by LicenseGeneratorStandalone)");
    }
}
