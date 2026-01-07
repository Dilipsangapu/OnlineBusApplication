package com.OnlineBusBooking.OnlineBus.util;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

import com.OnlineBusBooking.OnlineBus.model.Agent;
import com.OnlineBusBooking.OnlineBus.model.Booking;
import com.OnlineBusBooking.OnlineBus.model.Bus;
import com.OnlineBusBooking.OnlineBus.model.TripSchedule;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.Color;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.DashedBorder;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Div;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.properties.BorderRadius;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.VerticalAlignment;

public class TicketPDFGenerator {

    // Palette
    private static final Color PRIMARY = new DeviceRgb(0x2E, 0x5A, 0xAC);
    private static final Color SECONDARY_BG = new DeviceRgb(0xF8, 0xF9, 0xFA);
    private static final Color SUCCESS = new DeviceRgb(0x28, 0xA7, 0x45);
    private static final Color TEXT_DARK = new DeviceRgb(0x21, 0x25, 0x29);
    private static final Color TEXT_MUTED = new DeviceRgb(0x6C, 0x75, 0x7D);

    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy");
    private static final String DEFAULT_SUPPORT_EMAIL = "support@busco.com";
    private static final String DEFAULT_PHONE = "+91-800-000-0000";
    private static final String DEFAULT_EMERGENCY = "+91-112";

    public static byte[] generateTicketPDF(List<Booking> bookings, Bus bus, TripSchedule schedule, Agent agent) throws Exception {
        if (bookings == null || bookings.isEmpty()) {
            throw new IllegalArgumentException("No bookings provided");
        }

        Booking first = bookings.get(0);

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(outputStream);
        PdfDocument pdfDoc = new PdfDocument(writer);
        Document doc = new Document(pdfDoc, PageSize.A4);
        doc.setMargins(24, 24, 28, 24);

        PdfFont regular = PdfFontFactory.createFont(StandardFonts.HELVETICA);
        PdfFont bold = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);
        PdfFont mono = PdfFontFactory.createFont(StandardFonts.COURIER_BOLD);

        addWatermark(doc, pdfDoc, "E-TICKET");

        Div card = new Div()
                .setBackgroundColor(ColorConstants.WHITE)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 1f))
                .setBorderRadius(new BorderRadius(12))
                .setPadding(18)
                .setMarginTop(8);

        Div header = new Div().setPadding(14)
                .setBackgroundColor(PRIMARY)
                .setBorderRadius(new BorderRadius(10));
        header.add(new Paragraph("🚌 " + Optional.ofNullable(bus.getOperatorName()).orElse("Your Bus Co."))
                .setFont(bold).setFontSize(16).setFontColor(ColorConstants.WHITE));
        header.add(new Paragraph("Safe & Comfortable Journey")
                .setFont(regular).setFontSize(10).setFontColor(ColorConstants.WHITE));

        String ticketId = buildTicketId();
        Paragraph status = new Paragraph("CONFIRMED")
                .setFont(bold).setFontSize(9)
                .setBackgroundColor(SUCCESS)
                .setFontColor(ColorConstants.WHITE)
                .setPaddingLeft(8).setPaddingRight(8).setPaddingTop(4).setPaddingBottom(4)
                .setBorderRadius(new BorderRadius(12));
        Paragraph tid = new Paragraph("Ticket ID: " + ticketId)
                .setFont(mono).setFontSize(9).setFontColor(ColorConstants.WHITE);

        Table hdrTable = new Table(UnitValue.createPercentArray(new float[]{3, 1})).useAllAvailableWidth();
        Cell left = new Cell().setBorder(Border.NO_BORDER);
        left.add(header);
        Cell right = new Cell().setBorder(Border.NO_BORDER).setVerticalAlignment(VerticalAlignment.MIDDLE)
                .setTextAlignment(TextAlignment.RIGHT);
        right.add(status);
        right.add(tid);
        hdrTable.addCell(left);
        hdrTable.addCell(right);
        card.add(hdrTable);

        addLogo(card);

        String source = Optional.ofNullable(bus.getSource()).orElse(first.getPassengerFrom());
        String destination = Optional.ofNullable(bus.getDestination()).orElse(first.getPassengerTo());
        String route = source + " → " + destination;

        card.add(routeLine(source, destination, schedule, first, regular, bold));
        card.add(sectionTitle("🚌 Trip Details"));
        card.add(tripDetailsTable(source, destination, schedule, first, bus, bold, regular));
        card.add(sectionTitle("👤 Passenger(s)"));
        card.add(passengerTable(bookings, bold, regular));
        card.add(sectionTitle("💺 Seats & Fare"));
        card.add(seatsTable(bookings, bold, regular));
        card.add(fareBreakdown(bookings, bold, regular));
        card.add(sectionTitle("💰 Payment & Boarding"));
        card.add(paymentBoarding(schedule, first, agent, bold, regular));
        card.add(qrBlock(first, bus, route, bookings, bold, regular));
        card.add(footerInfo(first, agent, bold, regular));
        card.add(cutLine());

        doc.add(card);
        doc.close();
        return outputStream.toByteArray();
    }

    /* ---------- Components ---------- */

    private static void addWatermark(Document doc, PdfDocument pdfDoc, String text) {
        float angle = 45;
        for (int i = 1; i <= pdfDoc.getNumberOfPages(); i++) {
            Paragraph wm = new Paragraph(text)
                    .setFontSize(52)
                    .setFontColor(new DeviceRgb(220, 220, 220))
                    .setRotationAngle(Math.toRadians(angle));
            doc.showTextAligned(wm, PageSize.A4.getWidth() / 2, PageSize.A4.getHeight() / 2,
                    i, TextAlignment.CENTER, VerticalAlignment.MIDDLE, 0);
        }
    }

    private static void addLogo(Div card) {
        try (InputStream logoStream = TicketPDFGenerator.class.getResourceAsStream("/static/logo.png")) {
            if (logoStream != null && logoStream.available() > 0) {
                Image logo = new Image(ImageDataFactory.create(logoStream.readAllBytes()))
                        .scaleToFit(64, 64)
                        .setHorizontalAlignment(HorizontalAlignment.RIGHT)
                        .setMarginBottom(6);
                card.add(logo);
            }
        } catch (Exception ignored) {
        }
    }

    private static Div routeLine(String from, String to, TripSchedule schedule, Booking first, PdfFont regular, PdfFont bold) {
        Div wrap = new Div().setPadding(10)
                .setBackgroundColor(SECONDARY_BG)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.8f))
                .setBorderRadius(new BorderRadius(10));
        Paragraph line = new Paragraph(from + "  ————→  " + to)
                .setFont(bold).setFontSize(13).setFontColor(PRIMARY);
        String depart = fmt(schedule.getDepartureTime(), first.getTravelDate());
        String arrive = fmt(schedule.getArrivalTime(), first.getTravelDate());
        Paragraph times = new Paragraph((depart != null ? depart : "N/A") + "   •   " + (arrive != null ? arrive : "N/A"))
                .setFont(regular).setFontSize(10).setFontColor(TEXT_MUTED);
        wrap.add(line);
        wrap.add(times);
        return wrap;
    }

    private static Table tripDetailsTable(String source, String dest, TripSchedule schedule, Booking first, Bus bus,
                                          PdfFont bold, PdfFont regular) {
        Table t = new Table(UnitValue.createPercentArray(new float[]{1, 1})).useAllAvailableWidth()
                .setMarginTop(6).setMarginBottom(6);
        t.addCell(infoCell("From", source, bold, regular));
        t.addCell(infoCell("To", dest, bold, regular));
        t.addCell(infoCell("Departure", fmt(schedule.getDepartureTime(), first.getTravelDate()), bold, regular));
        t.addCell(infoCell("Arrival", fmt(schedule.getArrivalTime(), first.getTravelDate()), bold, regular));
        t.addCell(infoCell("Bus Type", Optional.ofNullable(bus.getBusType()).orElse("N/A"), bold, regular));
        t.addCell(infoCell("Amenities", "Wi-Fi • AC • Charger", bold, regular));
        return t;
    }

    private static Table passengerTable(List<Booking> bookings, PdfFont bold, PdfFont regular) {
        Table t = new Table(UnitValue.createPercentArray(new float[]{2, 3, 1, 2})).useAllAvailableWidth();
        addHeader(t, "Name", "Email", "Age", "Mobile", bold);
        boolean shade = false;
        for (Booking b : bookings) {
            Color rowBg = shade ? new DeviceRgb(0xF2, 0xF5, 0xF9) : ColorConstants.WHITE;
            shade = !shade;

            String passengerName = Optional.ofNullable(b.getPassengerName())
                    .filter(name -> !name.isBlank())
                    .orElse("N/A");

            String passengerEmail = Optional.ofNullable(b.getPassengerEmail())
                    .filter(email -> !email.isBlank())
                    .orElse(Optional.ofNullable(b.getCustomerEmail()).orElse("N/A"));

            String passengerMobile = Optional.ofNullable(b.getPassengerMobile())
                    .filter(mobile -> !mobile.isBlank())
                    .orElse("N/A");

            t.addCell(zebraCell(passengerName, regular, rowBg));
            t.addCell(zebraCell(passengerEmail, regular, rowBg));
            t.addCell(zebraCell(b.getPassengerAge() > 0 ? String.valueOf(b.getPassengerAge()) : "N/A", regular, rowBg));
            t.addCell(zebraCell(passengerMobile, regular, rowBg));
        }
        return t;
    }

    private static Table seatsTable(List<Booking> bookings, PdfFont bold, PdfFont regular) {
        Table t = new Table(UnitValue.createPercentArray(new float[]{1, 1, 1, 2})).useAllAvailableWidth()
                .setMarginBottom(6);
        addHeader(t, "Seat", "Type", "Fare (₹)", "From → To", bold);
        for (Booking b : bookings) {
            t.addCell(simpleCell(Optional.ofNullable(b.getSeatNumber()).orElse("N/A"), regular));
            t.addCell(simpleCell(seatTypeLabel(b.getSeatType()), regular));
            t.addCell(simpleCell(String.format("₹%.2f", b.getFare()), regular));
            t.addCell(simpleCell(Optional.ofNullable(b.getPassengerFrom()).orElse("N/A") + " → " +
                    Optional.ofNullable(b.getPassengerTo()).orElse("N/A"), regular));
        }
        return t;
    }

    // Use actual fare from bookings instead of recalculating
    private static Div fareBreakdown(List<Booking> bookings, PdfFont bold, PdfFont regular) {
        double actualTotal = bookings.stream().mapToDouble(Booking::getFare).sum();
        double subtotal = Math.round(actualTotal / 1.05 * 100.0) / 100.0;
        double tax = Math.round((actualTotal - subtotal) * 100.0) / 100.0;

        Div d = new Div().setPadding(10)
                .setBackgroundColor(SECONDARY_BG)
                .setBorder(new SolidBorder(ColorConstants.LIGHT_GRAY, 0.8f))
                .setBorderRadius(new BorderRadius(8));
        d.add(row("Subtotal", String.format("₹%.2f", subtotal), regular, bold));
        d.add(row("Tax (5%)", String.format("₹%.2f", tax), regular, bold));
        d.add(rowBold("Total Paid", String.format("₹%.2f", actualTotal), bold));
        return d;
    }

    private static Div paymentBoarding(TripSchedule schedule, Booking first, Agent agent, PdfFont bold, PdfFont regular) {
        Div d = new Div();
        d.add(row("Status", "Paid", regular, bold, SUCCESS));
        d.add(row("Boarding Point", Optional.ofNullable(first.getPassengerFrom()).orElse("N/A"), regular, bold));
        d.add(row("Platform / Gate", "Gate 1", regular, bold));
        d.add(row("Add to Calendar", "Departure: " + fmt(schedule.getDepartureTime(), first.getTravelDate()), regular, bold));

        String supportEmail = agentEmail(agent);
        d.add(row("Support", supportEmail, regular, bold));

        String phoneNumber = agentPhone(agent).orElse(Optional.ofNullable(first.getPassengerMobile())
                .filter(m -> !m.isBlank())
                .orElse(DEFAULT_PHONE));
        d.add(row("Phone", phoneNumber, regular, bold));

        String emergency = agentPhone(agent).orElse(DEFAULT_EMERGENCY);
        d.add(row("Emergency", emergency, regular, bold));

        return d;
    }

    private static Div qrBlock(Booking first, Bus bus, String route, List<Booking> bookings, PdfFont bold, PdfFont regular) throws Exception {
        Div d = new Div().setMarginTop(8);

        double actualTotal = bookings.stream().mapToDouble(Booking::getFare).sum();

        String qrContent = String.format(
                "Name:%s | Email:%s | Bus:%s | Route:%s | Date:%s | Paid: ₹%.2f",
                Optional.ofNullable(first.getPassengerName()).orElse("N/A"),
                Optional.ofNullable(first.getCustomerEmail()).orElse("N/A"),
                Optional.ofNullable(bus.getOperatorName()).orElse("N/A"),
                route,
                Optional.ofNullable(first.getTravelDate()).orElse("N/A"),
                actualTotal
        );

        ByteArrayOutputStream qrOut = new ByteArrayOutputStream();
        var matrix = new QRCodeWriter().encode(qrContent, BarcodeFormat.QR_CODE, 140, 140);
        MatrixToImageWriter.writeToStream(matrix, "PNG", qrOut);
        Image qrImg = new Image(ImageDataFactory.create(qrOut.toByteArray()))
                .setMaxHeight(140).setMaxWidth(140)
                .setHorizontalAlignment(HorizontalAlignment.CENTER);

        Paragraph caption = new Paragraph("Scan QR for ticket verification")
                .setFont(regular).setFontSize(9).setFontColor(TEXT_MUTED)
                .setTextAlignment(TextAlignment.CENTER);

        d.add(qrImg);
        d.add(caption);
        return d;
    }

    private static Div footerInfo(Booking first, Agent agent, PdfFont bold, PdfFont regular) {
        Div d = new Div().setMarginTop(10);
        d.add(new Paragraph("Company Contact")
                .setFont(bold).setFontSize(10).setFontColor(TEXT_DARK));

        String supportEmail = agentEmail(agent);
        d.add(new Paragraph("Email: " + supportEmail)
                .setFont(regular).setFontSize(9));

        String phoneNumber = agentPhone(agent).orElse(DEFAULT_PHONE);
        d.add(new Paragraph("Phone: " + phoneNumber)
                .setFont(regular).setFontSize(9));

        d.add(new Paragraph("Present this ticket at boarding • Keep a digital and printed copy.")
                .setFont(regular).setFontSize(8).setFontColor(TEXT_MUTED));
        d.add(new Paragraph("Terms:  Non-transferable • Subject to operator T&C • Follow luggage rules • COVID guidelines may apply.")
                .setFont(regular).setFontSize(7).setFontColor(TEXT_MUTED));
        return d;
    }

    private static Div cutLine() {
        Div d = new Div().setMarginTop(10);
        d.add(new Paragraph("⋯⋯⋯⋯⋯⋯⋯⋯ Cut here ⋯⋯⋯⋯⋯⋯⋯⋯")
                .setTextAlignment(TextAlignment.CENTER)
                .setFontSize(8)
                .setFontColor(TEXT_MUTED)
                .setBorderTop(new DashedBorder(ColorConstants.LIGHT_GRAY, 0.5f)));
        return d;
    }

    /* ---------- Helpers ---------- */

    private static Cell infoCell(String label, String value, PdfFont bold, PdfFont regular) {
        Paragraph p = new Paragraph()
                .add(new Text(label + "\n").setFont(bold).setFontSize(9).setFontColor(TEXT_MUTED))
                .add(new Text(Optional.ofNullable(value).orElse("N/A")).setFont(regular).setFontSize(11).setFontColor(TEXT_DARK));
        return new Cell().setBorder(Border.NO_BORDER).add(p);
    }

    private static void addHeader(Table t, String h1, String h2, String h3, String h4, PdfFont bold) {
        t.addHeaderCell(headerCell(h1, bold));
        t.addHeaderCell(headerCell(h2, bold));
        t.addHeaderCell(headerCell(h3, bold));
        t.addHeaderCell(headerCell(h4, bold));
    }

    private static Cell headerCell(String text, PdfFont bold) {
        return new Cell().add(new Paragraph(text).setFont(bold).setFontSize(10).setFontColor(ColorConstants.WHITE))
                .setBackgroundColor(PRIMARY)
                .setTextAlignment(TextAlignment.CENTER)
                .setPadding(5);
    }

    private static Cell zebraCell(String text, PdfFont font, Color bg) {
        return new Cell().add(new Paragraph(text).setFont(font).setFontSize(10).setFontColor(TEXT_DARK))
                .setBackgroundColor(bg)
                .setPadding(5)
                .setBorder(Border.NO_BORDER);
    }

    private static Cell simpleCell(String text, PdfFont font) {
        return new Cell().add(new Paragraph(Optional.ofNullable(text).orElse("N/A"))
                        .setFont(font).setFontSize(10).setFontColor(TEXT_DARK))
                .setPadding(5)
                .setBorder(Border.NO_BORDER);
    }

    private static Paragraph row(String label, String value, PdfFont regular, PdfFont bold) {
        return row(label, value, regular, bold, TEXT_DARK);
    }

    private static Paragraph row(String label, String value, PdfFont regular, PdfFont bold, Color valueColor) {
        return new Paragraph()
                .add(new Text(label + ": ").setFont(bold).setFontSize(9).setFontColor(TEXT_MUTED))
                .add(new Text(value).setFont(regular).setFontSize(10).setFontColor(valueColor));
    }

    private static Paragraph rowBold(String label, String value, PdfFont bold) {
        return new Paragraph()
                .add(new Text(label + ": ").setFont(bold).setFontSize(10).setFontColor(TEXT_DARK))
                .add(new Text(value).setFont(bold).setFontSize(11).setFontColor(TEXT_DARK));
    }

    private static String seatTypeLabel(String seatType) {
        if (seatType == null) return "🪑 Standard";
        String lower = seatType.toLowerCase();
        if (lower.contains("premium") || lower.contains("sleeper")) return "🛋️ Premium";
        return "🪑 " + seatType;
    }

    private static String fmt(String time, String date) {
        if (time == null) return "N/A";
        try {
            LocalDate d = date != null ? LocalDate.parse(date) : LocalDate.now();
            return d.format(DAY_FMT) + " | " + time;
        } catch (Exception e) {
            return time;
        }
    }

    private static Div sectionTitle(String text) {
        return new Div().add(new Paragraph(text)
                .setFontSize(12).setBold().setFontColor(PRIMARY)
                .setMarginTop(10).setMarginBottom(4));
    }

    private static String buildTicketId() {
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        int rand = ThreadLocalRandom.current().nextInt(10000, 99999);
        return "TKT-" + date + "-" + rand;
    }

    // Agent helpers (no fallback to customer email)
    private static String agentEmail(Agent agent) {
        return Optional.ofNullable(agent)
                .map(Agent::getEmail)
                .filter(e -> !e.isBlank())
                .orElse(DEFAULT_SUPPORT_EMAIL);
    }

    private static Optional<String> agentPhone(Agent agent) {
        return Optional.ofNullable(agent)
                .map(Agent::getPhone)
                .filter(p -> p != null && !p.isBlank());
    }
}