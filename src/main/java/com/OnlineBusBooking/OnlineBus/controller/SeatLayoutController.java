package com.OnlineBusBooking.OnlineBus.controller;

import com.OnlineBusBooking.OnlineBus.model.SeatLayout;
import com.OnlineBusBooking.OnlineBus.repository.SeatLayoutRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/seats")
public class SeatLayoutController {

    @Autowired
    private SeatLayoutRepository seatLayoutRepository;

    // ✅ Save or update seat layout
    @PostMapping("/save")
    public ResponseEntity<?> saveLayout(@RequestBody SeatLayout layout) {
        if (layout.getBusId() == null || layout.getBusId().isEmpty()) {
            return ResponseEntity.badRequest().body("❗ Bus ID is required.");
        }

        if (layout.getSeats() == null || layout.getSeats().isEmpty()) {
            return ResponseEntity.badRequest().body("❗ Seat list cannot be empty.");
        }

        // Overwrite if layout already exists for the bus
        Optional<SeatLayout> existing = seatLayoutRepository.findByBusId(layout.getBusId());
        existing.ifPresent(value -> layout.setId(value.getId()));

        SeatLayout saved = seatLayoutRepository.save(layout);
        return ResponseEntity.ok(saved);
    }

    // ✅ Get layout by busId
    @GetMapping("/by-bus/{busId}")
    public ResponseEntity<?> getLayoutByBusId(@PathVariable String busId) {
        Optional<SeatLayout> layoutOpt = seatLayoutRepository.findByBusId(busId);
        return layoutOpt.<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body("❌ No seat layout found for busId: " + busId));
    }

    // ✅ Optional: Delete layout by busId (admin use)
    @DeleteMapping("/delete/{busId}")
    public ResponseEntity<String> deleteLayoutByBusId(@PathVariable String busId) {
        Optional<SeatLayout> layoutOpt = seatLayoutRepository.findByBusId(busId);
        if (layoutOpt.isEmpty()) {
            return ResponseEntity.status(404).body("❌ No seat layout to delete for busId: " + busId);
        }
        seatLayoutRepository.deleteById(layoutOpt.get().getId());
        return ResponseEntity.ok("✅ Seat layout deleted for busId: " + busId);
    }
}
