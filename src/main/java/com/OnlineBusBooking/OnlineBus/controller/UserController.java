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

    @Autowired
    private BusRepository busRepository;
    @Autowired
    private TripScheduleRepository tripScheduleRepository;
    @Autowired
    private BookingRepository bookingRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RouteRepository routeRepository;
    @Autowired
    private EmailService emailService;
    @Autowired
    private SeatLayoutRepository seatLayoutRepository;



    @GetMapping("/dashboard")
    public String showUserDashboard(HttpSession session, Principal principal, Model model) {
        String email = principal.getName();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();

            // ✅ FIX: UNCOMMENT these two lines.
            // This puts the user's details into the HttpSession,
            // which allows th:data-email="${session.email}" to work.
            session.setAttribute("email", user.getEmail());
            session.setAttribute("name", user.getName());

            // This line is good to have for other Thymeleaf elements.
            // I've renamed it from "session" to "user" to avoid confusion.
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
                        
                        // Calculate estimated fare
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
            // Use the exact same logic as passenger-details.js updateFareForSeat()
            int fromIdx = fullPath.indexOf(from);
            int toIdx = fullPath.lastIndexOf(to);
            
            if (fromIdx == -1 || toIdx == -1 || fromIdx >= toIdx) {
                return 0.0;
            }
            
            // Get seat layout to find minimum fare
            Optional<SeatLayout> layoutOpt = seatLayoutRepository.findByBusId(busId);
            if (layoutOpt.isEmpty()) {
                return 0.0;
            }
            
            SeatLayout layout = layoutOpt.get();
            double minFare = Double.MAX_VALUE;
            
            for (SeatLayout.Seat seat : layout.getSeats()) {
                double basePrice = seat.getPrice();
                
                // Use the exact same calculation as passenger-details.js
                double newFare = 0;
                if (fromIdx >= 0 && toIdx > fromIdx) {
                    int totalSegments = fullPath.size() - 1;
                    if (totalSegments > 0) {
                        int traveledSegments = toIdx - fromIdx;
                        double ratio = (double) traveledSegments / totalSegments;
                        double calculatedFare = basePrice * ratio;
                        
                        calculatedFare = Math.round(calculatedFare * 100.0) / 100.0;
                        newFare = Math.max(50.0, calculatedFare); // Minimum fare
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
            entry.put("id", booking.getId()); // The unique ID for the booking
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
        if (bookingRepository.existsByBusIdAndTravelDateAndSeatNumber(booking.getBusId(), booking.getTravelDate(), booking.getSeatNumber())) {
            return ResponseEntity.status(409).body("❌ Seat already booked.");
        }
        Optional<Bus> busOpt = busRepository.findById(booking.getBusId());
        Optional<Route> routeOpt = routeRepository.findByBusId(booking.getBusId()).stream().findFirst();
        if (busOpt.isEmpty() || routeOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("❌ Bus or Route not found.");
        }
        Route route = routeOpt.get();
        List<String> stops = new ArrayList<>(List.of(route.getFrom().toLowerCase()));
        if (route.getStops() != null) stops.addAll(route.getStops().stream().map(String::toLowerCase).toList());
        stops.add(route.getTo().toLowerCase());
        String from = booking.getPassengerFrom().toLowerCase();
        String to = booking.getPassengerTo().toLowerCase();
        int fromIndex = stops.indexOf(from);
        int toIndex = stops.indexOf(to);
        if (fromIndex == -1 || toIndex == -1 || fromIndex >= toIndex) {
            return ResponseEntity.badRequest().body("❌ Invalid stop selection.");
        }
        double seatPrice = seatLayoutRepository.findByBusId(booking.getBusId())
                .flatMap(layout -> layout.getSeats().stream()
                        .filter(s -> s.getNumber().equalsIgnoreCase(booking.getSeatNumber()))
                        .findFirst())
                .map(SeatLayout.Seat::getPrice)
                .orElse(0);
        if (seatPrice == 0.0) {
            return ResponseEntity.badRequest().body("❌ Seat not found in layout.");
        }
        double segmentRatio = (double) (toIndex - fromIndex) / (stops.size() - 1);
        double finalFare = Math.max(50.0, Math.round(seatPrice * segmentRatio * 100.0) / 100.0);
        booking.setFare(finalFare);
        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);
        return ResponseEntity.ok("✅ Booking confirmed. ₹" + finalFare);
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

        // ✅ FIX: Reverted this logic to be compatible with your existing BookingRepository.
        // This is less efficient but will not cause a crash.
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
            byte[] pdf = TicketPDFGenerator.generateTicketPDF(bookings, busOpt.get(), scheduleOpt.get());
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
            byte[] pdf = TicketPDFGenerator.generateTicketPDF(List.of(booking), busOpt.get(), scheduleOpt.get());
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
        return "passenger-details"; // This maps to passenger-details.html
    }

}