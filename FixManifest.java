import java.io.*;
import java.util.jar.*;
import java.util.zip.*;

public class FixManifest {
    public static void main(String[] args) throws Exception {
        File src = new File("target/persian-calendar-plugin-11.4.24-jakarta.jar");
        File dest = new File("target/persian-calendar-plugin-11.4.24-jakarta-patched.jar");
        try (JarInputStream jin = new JarInputStream(new FileInputStream(src));
             JarOutputStream jout = new JarOutputStream(new FileOutputStream(dest))) {
             
            Manifest manifest = jin.getManifest();
            if (manifest != null) {
                String importPackage = manifest.getMainAttributes().getValue("Import-Package");
                System.out.println("BEFORE: " + importPackage);
                if (importPackage != null) {
                    importPackage = importPackage.replace("[5.0,6)", "[5.0,7)");
                    manifest.getMainAttributes().putValue("Import-Package", importPackage);
                }
                
                String symName = manifest.getMainAttributes().getValue("Bundle-SymbolicName");
                if (symName != null && !symName.endsWith(".jakarta")) {
                    manifest.getMainAttributes().putValue("Bundle-SymbolicName", symName + ".jakarta");
                }
                
                String name = manifest.getMainAttributes().getValue("Bundle-Name");
                if (name != null && !name.endsWith(" Jakarta")) {
                    manifest.getMainAttributes().putValue("Bundle-Name", name + " Jakarta");
                }
                
                ZipEntry e = new ZipEntry("META-INF/MANIFEST.MF");
                jout.putNextEntry(e);
                manifest.write(jout);
                jout.closeEntry();
            }
            
            byte[] buffer = new byte[1024];
            int bytesRead;
            JarEntry entry;
            while ((entry = jin.getNextJarEntry()) != null) {
                if (entry.getName().equals("META-INF/MANIFEST.MF")) continue;
                jout.putNextEntry(new JarEntry(entry.getName()));
                while ((bytesRead = jin.read(buffer)) != -1) {
                    jout.write(buffer, 0, bytesRead);
                }
                jout.closeEntry();
            }
        }
        src.delete();
        dest.renameTo(src);
    }
}
