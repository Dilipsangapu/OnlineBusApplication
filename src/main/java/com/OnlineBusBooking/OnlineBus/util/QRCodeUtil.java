package com.BusBooking.Bus.util;



import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.UUID;

public class QRCodeUtil {

    public static byte[] generateQRCodeImage(String text, int width, int height) throws WriterException, IOException {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        var bitMatrix = qrCodeWriter.encode(text, BarcodeFormat.QR_CODE, width, height);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
        return outputStream.toByteArray();
    }

    public static Path saveQRCodeToTempFile(String content) throws IOException, WriterException {
        String fileName = "ticket-qr-" + UUID.randomUUID() + ".png";
        Path filePath = Files.createTempFile(fileName, ".png");
        byte[] imageData = generateQRCodeImage(content, 250, 250);
        Files.write(filePath, imageData);
        return filePath;
    }
}