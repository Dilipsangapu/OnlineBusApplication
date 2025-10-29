package com.OnlineBusBooking.OnlineBus.controller;

import com.OnlineBusBooking.OnlineBus.model.Route;
import com.OnlineBusBooking.OnlineBus.model.TripSchedule;
import com.OnlineBusBooking.OnlineBus.repository.RouteRepository;
import com.OnlineBusBooking.OnlineBus.repository.TripScheduleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/schedule")
public class TripScheduleController {

    @Autowired
    private TripScheduleRepository tripScheduleRepository;

    @Autowired
    private RouteRepository routeRepository;

    // ✅ CREATE: Add new trip schedule
    @PostMapping("/add")
    public ResponseEntity<?> add(@RequestBody TripSchedule schedule) {
        if (schedule.getBusId() == null || schedule.getDate() == null) {
            return ResponseEntity.badRequest().body("❗ busId and date are required.");
        }

        if (schedule.getRouteId() == null || schedule.getRouteId().isEmpty()) {
            List<Route> routes = routeRepository.findByBusId(schedule.getBusId());
            if (routes.isEmpty()) {
                return ResponseEntity.badRequest().body("❌ No route found for busId: " + schedule.getBusId());
            }
            schedule.setRouteId(routes.get(0).getId());
        }

        TripSchedule saved = tripScheduleRepository.save(schedule);
        return ResponseEntity.ok(saved);
    }

    // ✅ READ: Get all schedules
    @GetMapping("/all")
    public List<TripSchedule> getAll() {
        return tripScheduleRepository.findAll();
    }

    // ✅ READ: Get schedules by bus ID
    @GetMapping("/by-bus/{busId}")
    public List<TripSchedule> getByBus(@PathVariable String busId) {
        return tripScheduleRepository.findByBusId(busId);
    }

    // ✅ READ: Get schedule by ID
    @GetMapping("/get/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        Optional<TripSchedule> opt = tripScheduleRepository.findById(id);
        return opt.<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ✅ UPDATE: Update a schedule
    @PutMapping("/update/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody TripSchedule updatedSchedule) {
        Optional<TripSchedule> existingOpt = tripScheduleRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        TripSchedule existing = existingOpt.get();
        existing.setDate(updatedSchedule.getDate());
        existing.setDepartureTime(updatedSchedule.getDepartureTime());
        existing.setArrivalTime(updatedSchedule.getArrivalTime());

        if (updatedSchedule.getRouteId() != null)
            existing.setRouteId(updatedSchedule.getRouteId());

        if (updatedSchedule.getBusId() != null)
            existing.setBusId(updatedSchedule.getBusId());

        return ResponseEntity.ok(tripScheduleRepository.save(existing));
    }

    // ✅ DELETE: Delete by ID
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> delete(@PathVariable String id) {
        if (!tripScheduleRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tripScheduleRepository.deleteById(id);
        return ResponseEntity.ok("✅ Deleted schedule with ID: " + id);
    }
}
