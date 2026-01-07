package com.OnlineBusBooking.OnlineBus.controller;

import com.OnlineBusBooking.OnlineBus.model.*;
import com.OnlineBusBooking.OnlineBus.repository.*;
import com.OnlineBusBooking.OnlineBus.service.EmailService;
import com.OnlineBusBooking.OnlineBus.util.TicketPDFGenerator;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.*;

@Controller
@RequestMapping("/user")
public class UserController {

    @Autowired private BusRepository busRepository;
    @Autowired private TripScheduleRepository tripScheduleRepository;
    @Autowired private BookingRepository bookingRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RouteRepository routeRepository;
    @Autowired private EmailService emailService;
    @Autowired private SeatLayoutRepository seatLayoutRepository;
    @Autowired private AgentRepository agentRepository; // added

    @GetMapping("/dashboard")
    public String showUserDashboard(HttpSession session, Principal principal, Model model) {
        String email = principal.getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            session.setAttribute("email", user.getEmail());
            session.setAttribute("name", user.getName());
            model.addAttribute("user", user);
            return "userDashboard";
        }
        return "redirect:/login";
    }

    @GetMapping("/api/search-buses")
    @ResponseBody
    public List<Map<String, Object>> searchBuses(@RequestParam String from, @RequestParam String to, @RequestParam String date) {
        LocalDate travelDate = LocalDate.parse(date);
        List<Route> allRoutes = routeRepository.findAll();
        List<Map<String, Object>> results = new ArrayList<>();
        String fromLower = from.toLowerCase();
        String toLower = to.toLowerCase();
        for (Route route : allRoutes) {
            boolean validRoute = false;
            List<String> fullPath = new ArrayList<>(List.of(route.getFrom().toLowerCase()));
            if (route.getStops() != null) fullPath.addAll(route.getStops().stream().map(String::toLowerCase).toList());
            fullPath.add(route.getTo().toLowerCase());
            if (fullPath.contains(fromLower) && fullPath.contains(toLower)) {
                int fromIndex = fullPath.indexOf(fromLower);
                int toIndex = fullPath.indexOf(toLower);
                if (fromIndex < toIndex) {
                    validRoute = true;
                }
            }
            if (validRoute) {
                List<TripSchedule> schedules = tripScheduleRepository.findByRouteIdAndDate(route.getId(), travelDate);
                for (TripSchedule schedule : schedules) {
                    busRepository.findById(schedule.getBusId()).ifPresent(bus -> {
                        Map<String, Object> result = new HashMap<>();
                        result.put("id", bus.getId());
                        result.put("busId", bus.getId());
                        result.put("busName", bus.getBusName());
                        result.put("busNumber", bus.getBusNumber());
                        result.put("busType", bus.getBusType());
                        result.put("departureTime", schedule.getDepartureTime());
                        result.put("arrivalTime", schedule.getArrivalTime());
                        double estimatedFare = calculateEstimatedFare(bus.getId(), fromLower, toLower, fullPath);
                        result.put("estimatedFare", estimatedFare);
                        results.add(result);
                    });
                }
            }
        }
        return results;
    }

    private double calculateEstimatedFare(String busId, String from, String to, List<String> fullPath) {
        try {
            int fromIdx = fullPath.indexOf(from);
            int toIdx = fullPath.lastIndexOf(to);
            if (fromIdx == -1 || toIdx == -1 || fromIdx >= toIdx) {
                return 0.0;
            }
            Optional<SeatLayout> layoutOpt = seatLayoutRepository.findByBusId(busId);
            if (layoutOpt.isEmpty()) {
                return 0.0;
            }
            SeatLayout layout = layoutOpt.get();
            double minFare = Double.MAX_VALUE;
            for (SeatLayout.Seat seat : layout.getSeats()) {
                double basePrice = seat.getPrice();
                double newFare = 0;
                if (fromIdx >= 0 && toIdx > fromIdx) {
                    int totalSegments = fullPath.size() - 1;
                    if (totalSegments > 0) {
                        int traveledSegments = toIdx - fromIdx;
                        double ratio = (double) traveledSegments / totalSegments;
                        double calculatedFare = basePrice * ratio;
                        calculatedFare = Math.round(calculatedFare * 100.0) / 100.0;
                        newFare = Math.max(50.0, calculatedFare);
                    }
                }
                if (newFare > 0) {
                    minFare = Math.min(minFare, newFare);
                }
            }
            return Double.isFinite(minFare) ? minFare : 0.0;
        } catch (Exception e) {
            return 0.0;
        }
    }

    @GetMapping("/api/route/stops/{busId}")
    @ResponseBody
    public List<String> getStopsByBusId(@PathVariable String busId) {
        return routeRepository.findByBusId(busId).stream()
                .findFirst()
                .map(route -> {
                    List<String> stops = new ArrayList<>(List.of(route.getFrom().toLowerCase()));
                    if (route.getStops() != null)
                        stops.addAll(route.getStops().stream().map(String::toLowerCase).toList());
                    stops.add(route.getTo().toLowerCase());
                    return stops;
                })
                .orElse(Collections.emptyList());
    }

    @GetMapping("/api/booked-seats")
    @ResponseBody
    public List<String> getBookedSeats(@RequestParam String busId, @RequestParam String date) {
        return bookingRepository.findByBusIdAndTravelDate(busId, date).stream()
                .map(Booking::getSeatNumber)
                .toList();
    }

    @GetMapping("/api/bookings/by-user/{email}")
    @ResponseBody
    public List<Map<String, Object>> getBookingsByUser(@PathVariable String email) {
        List<Booking> bookings = bookingRepository.findByCustomerEmail(email);
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Booking booking : bookings) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("id", booking.getId());
            entry.put("busId", booking.getBusId());
            entry.put("busName", busRepository.findById(booking.getBusId()).map(Bus::getBusName).orElse("Unknown Bus"));
            entry.put("routeFrom", booking.getPassengerFrom());
            entry.put("routeTo", booking.getPassengerTo());
            entry.put("travelDate", booking.getTravelDate());
            entry.put("seatNumber", booking.getSeatNumber());
            entry.put("fare", booking.getFare());
            entry.put("status", booking.getStatus());
            entry.put("passengerName", booking.getPassengerName());
            entry.put("passengerMobile", booking.getPassengerMobile());
            entry.put("email", booking.getCustomerEmail());
            enriched.add(entry);
        }
        return enriched;
    }

    @PostMapping("/api/bookings/book")
    @ResponseBody
    public ResponseEntity<String> bookTicket(@RequestBody Booking booking) {
        if (bookingRepository.existsByBusIdAndTravelDateAndSeatNumber(
                booking.getBusId(), booking.getTravelDate(), booking.getSeatNumber())) {
            return ResponseEntity.status(409).body("❌ Seat already booked.");
        }

        // Validate bus/route exist
        Optional<Bus> busOpt = busRepository.findById(booking.getBusId());
        Optional<Route> routeOpt = routeRepository.findByBusId(booking.getBusId()).stream().findFirst();
        if (busOpt.isEmpty() || routeOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("❌ Bus or Route not found.");
        }

        // Validate seat exists and get its base price (for sanity bounds)
        double seatPrice = seatLayoutRepository.findByBusId(booking.getBusId())
                .flatMap(layout -> layout.getSeats().stream()
                        .filter(s -> s.getNumber().equalsIgnoreCase(booking.getSeatNumber()))
                        .findFirst())
                .map(SeatLayout.Seat::getPrice)
                .orElse(0);
        if (seatPrice <= 0) {
            return ResponseEntity.badRequest().body("❌ Seat not found in layout.");
        }

        // Use the fare sent by the client (already charged in Razorpay), with simple bounds
        double clientFare = booking.getFare();
        if (clientFare <= 0) {
            return ResponseEntity.badRequest().body("❌ Invalid fare.");
        }
        clientFare = Math.max(50.0, clientFare);   // minimum fare
        clientFare = Math.min(clientFare, seatPrice); // optional: cap to seat base price

        booking.setFare(Math.round(clientFare * 100.0) / 100.0);
        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);

        return ResponseEntity.ok("✅ Booking confirmed. ₹" + booking.getFare());
    }

    @PostMapping("/api/finalize-booking")
    @ResponseBody
    public ResponseEntity<String> finalizeBooking(@RequestBody Map<String, Object> payload) {
        String email = (String) payload.get("email");
        String busId = (String) payload.get("busId");
        String travelDateStr = (String) payload.get("travelDate");
        List<String> seatNumbers = (List<String>) payload.get("seatNumbers");
        if (email == null || busId == null || travelDateStr == null || seatNumbers == null) {
            return ResponseEntity.badRequest().body("Missing required fields.");
        }

        List<Booking> bookings = bookingRepository.findByCustomerEmail(email).stream()
                .filter(b -> b.getBusId().equals(busId)
                        && b.getTravelDate().equals(travelDateStr)
                        && seatNumbers.contains(b.getSeatNumber()))
                .toList();

        Optional<Bus> busOpt = busRepository.findById(busId);
        Optional<TripSchedule> scheduleOpt = tripScheduleRepository.findByBusIdAndDate(busId, LocalDate.parse(travelDateStr)).stream().findFirst();
        if (bookings.isEmpty() || busOpt.isEmpty() || scheduleOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("No bookings or schedule found for finalization.");
        }
        try {
            Optional<Agent> agentOpt = agentRepository.findById(busOpt.get().getOperatorId());
            byte[] pdf = TicketPDFGenerator.generateTicketPDF(bookings, busOpt.get(), scheduleOpt.get(), agentOpt.orElse(null));
            emailService.sendTicket(email, pdf, "ticket.pdf", bookings, busOpt.get());
            return ResponseEntity.ok("📧 Ticket emailed successfully.");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("❌ Failed to generate/send ticket.");
        }
    }

    @GetMapping("/api/bookings/download-ticket/{bookingId}")
    public ResponseEntity<byte[]> downloadTicket(@PathVariable String bookingId) {
        Optional<Booking> bookingOpt = bookingRepository.findById(bookingId);
        if (bookingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Booking booking = bookingOpt.get();
        Optional<Bus> busOpt = busRepository.findById(booking.getBusId());
        Optional<TripSchedule> scheduleOpt = tripScheduleRepository.findByBusIdAndDate(booking.getBusId(), LocalDate.parse(booking.getTravelDate())).stream().findFirst();
        if (busOpt.isEmpty() || scheduleOpt.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Optional<Agent> agentOpt = agentRepository.findById(busOpt.get().getOperatorId());
            byte[] pdf = TicketPDFGenerator.generateTicketPDF(List.of(booking), busOpt.get(), scheduleOpt.get(), agentOpt.orElse(null));
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=ticket_" + booking.getSeatNumber() + ".pdf")
                    .header("Content-Type", "application/pdf")
                    .body(pdf);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/passenger-details.html")
    public String showPassengerDetailsPage() {
        return "passenger-details";
    }
}