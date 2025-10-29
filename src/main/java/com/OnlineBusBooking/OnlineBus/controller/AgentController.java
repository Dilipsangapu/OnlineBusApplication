
package com.OnlineBusBooking.OnlineBus.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.ModelAndView;

import com.OnlineBusBooking.OnlineBus.model.Booking;
import com.OnlineBusBooking.OnlineBus.model.Bus;
import com.OnlineBusBooking.OnlineBus.model.Route;
import com.OnlineBusBooking.OnlineBus.model.TripSchedule;
import com.OnlineBusBooking.OnlineBus.model.User;
import com.OnlineBusBooking.OnlineBus.repository.BookingRepository;
import com.OnlineBusBooking.OnlineBus.repository.BusRepository;
import com.OnlineBusBooking.OnlineBus.repository.RouteRepository;
import com.OnlineBusBooking.OnlineBus.repository.TripScheduleRepository;
import com.OnlineBusBooking.OnlineBus.repository.UserRepository;

import jakarta.servlet.http.HttpSession;

@Controller
@RequestMapping("/agent")
public class AgentController {

    @Autowired
    private BusRepository busRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ✅ Agent Dashboard
    @GetMapping("/dashboard")
    public String showAgentDashboard(HttpSession session, Model model) {
        String email = (String) session.getAttribute("email");
        String name = (String) session.getAttribute("name");

        if (email == null || name == null) {
            return "redirect:/login";
        }

        model.addAttribute("email", email);
        model.addAttribute("name", name);
        return "agentDashboard";
    }

    // ✅ Get buses assigned to agent
    @GetMapping("/buses")
    @ResponseBody
    public List<Bus> getAgentBuses(HttpSession session) {
        String email = (String) session.getAttribute("email");
        if (email == null) return List.of();
        return busRepository.findByOperatorId(email);
    }

    // ✅ Show bus edit form
    @GetMapping("/edit-bus/{id}")
    public ModelAndView showEditBusForm(@PathVariable String id, HttpSession session) {
        if (session.getAttribute("email") == null) {
            return new ModelAndView("redirect:/login");
        }

        Optional<Bus> busOpt = busRepository.findById(id);
        return busOpt.map(bus -> new ModelAndView("edit-bus").addObject("bus", bus))
                .orElseGet(() -> new ModelAndView("error").addObject("message", "Bus not found"));
    }

    // ✅ Save updated bus
    @PostMapping("/edit-bus/{id}")
    public ModelAndView updateBus(@PathVariable String id, @ModelAttribute Bus updatedBus, HttpSession session) {
        if (session.getAttribute("email") == null) {
            return new ModelAndView("redirect:/login");
        }

        Optional<Bus> existingBusOpt = busRepository.findById(id);
        if (existingBusOpt.isEmpty()) {
            return new ModelAndView("error").addObject("message", "Bus not found");
        }

        Bus existingBus = existingBusOpt.get();

        updatedBus.setId(existingBus.getId());
        updatedBus.setOperatorId(existingBus.getOperatorId());
        updatedBus.setOperatorName(existingBus.getOperatorName());

        updatedBus.setTotalSeats(updatedBus.getSleeperCount() + updatedBus.getSeaterCount());
        updatedBus.setHasUpperDeck("Upper + Lower".equals(updatedBus.getDeckType()));
        updatedBus.setHasLowerDeck(true);

        busRepository.save(updatedBus);
        return new ModelAndView("redirect:/agent/dashboard");
    }

    // ✅ Add new agent (via JS)
    @PostMapping("/api/agents/add")
    @ResponseBody
    public ResponseEntity<String> addAgent(@RequestBody User agent) {
        if (agent.getEmail() == null || agent.getPassword() == null) {
            return ResponseEntity.badRequest().body("❌ Invalid data");
        }

        String email = agent.getEmail().trim().toLowerCase();
        agent.setEmail(email);

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body("❌ Agent with this email already exists.");
        }

        agent.setRole("agent");
        agent.setPassword(passwordEncoder.encode(agent.getPassword()));

        userRepository.save(agent);
        return ResponseEntity.ok("✅ Agent added successfully!");
    }

    // ✅ Get all agents
    @GetMapping("/api/agents/all")
    @ResponseBody
    public List<User> getOnlyAgents() {
        return userRepository.findByRole("agent");
    }
    @Autowired
    private BookingRepository bookingRepository;

    @GetMapping("/api/bookings/by-agent/{email:.+}")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getBookingsByAgent(@PathVariable String email) {
        List<Bus> buses = busRepository.findByOperatorId(email);
        List<String> busIds = buses.stream().map(Bus::getId).toList();
        List<Booking> bookings = bookingRepository.findByBusIdIn(busIds);

        List<Map<String, Object>> enriched = new ArrayList<>();

        for (Booking booking : bookings) {
            Optional<Bus> busOpt = busRepository.findById(booking.getBusId());

            String busName = busOpt.map(Bus::getBusName).orElse("Unknown Bus");
            String routeFrom = booking.getPassengerFrom();
            String routeTo = booking.getPassengerTo();

            Map<String, Object> entry = new HashMap<>();
            entry.put("busName", busName);
            entry.put("routeFrom", routeFrom);
            entry.put("routeTo", routeTo);
            entry.put("travelDate", booking.getTravelDate());
            entry.put("seatNumber", booking.getSeatNumber());
            entry.put("fare", booking.getFare());
            entry.put("status", booking.getStatus());
            entry.put("passengerName", booking.getPassengerName());
            entry.put("passengerMobile", booking.getPassengerMobile());
            entry.put("email", booking.getCustomerEmail());

            enriched.add(entry);
        }

        return ResponseEntity.ok(enriched);
    }
    @Autowired
    private RouteRepository routeRepository;
    @Autowired
    private TripScheduleRepository tripScheduleRepository;
    @GetMapping("/api/stats/{agentEmail:.+}")
    @ResponseBody
    public Map<String, Object> getAgentStats(@PathVariable String agentEmail) {
        Map<String, Object> stats = new HashMap<>();

        List<Bus> buses = busRepository.findByOperatorId(agentEmail);
        List<String> busIds = buses.stream().map(Bus::getId).toList();

        List<Route> routes = routeRepository.findByBusIdIn(busIds);
        List<TripSchedule> schedules = tripScheduleRepository.findByBusIdIn(busIds);
        List<Booking> bookings = bookingRepository.findByBusIdIn(busIds);

        double totalRevenue = bookings.stream().mapToDouble(Booking::getFare).sum();

        stats.put("totalBuses", buses.size());
        stats.put("totalRoutes", routes.size());
        stats.put("totalSchedules", schedules.size());
        stats.put("totalBookings", bookings.size());
        stats.put("totalRevenue", Math.round(totalRevenue));

        return stats;
    }

    // ✅ Session-based fallback: when frontend does not send email in path
    @GetMapping("/api/stats")
    @ResponseBody
    public Map<String, Object> getAgentStatsFromSession(HttpSession session) {
        String agentEmail = (String) session.getAttribute("email");
        if (agentEmail == null || agentEmail.isBlank()) {
            // Return zeros so UI renders without crashing; frontend shows a message already
            Map<String, Object> empty = new HashMap<>();
            empty.put("totalBuses", 0);
            empty.put("totalRoutes", 0);
            empty.put("totalSchedules", 0);
            empty.put("totalBookings", 0);
            empty.put("totalRevenue", 0);
            return empty;
        }
        return getAgentStats(agentEmail);
    }

    // ✅ Bookings session-based fallback
    @GetMapping("/api/bookings/by-agent")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getBookingsByAgentFromSession(HttpSession session) {
        String email = (String) session.getAttribute("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        return getBookingsByAgent(email);
    }

    // ✅ Alias to match frontend: GET /agent/api/bookings
    @GetMapping("/api/bookings")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getBookingsAlias(HttpSession session) {
        return getBookingsByAgentFromSession(session);
    }


}
