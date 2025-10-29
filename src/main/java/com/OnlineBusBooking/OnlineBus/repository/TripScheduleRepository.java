package com.OnlineBusBooking.OnlineBus.repository;

import com.OnlineBusBooking.OnlineBus.model.TripSchedule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface TripScheduleRepository extends MongoRepository<TripSchedule, String> {
    List<TripSchedule> findByBusId(String busId);
    List<TripSchedule> findByBusIdIn(List<String> busIds);
    List<TripSchedule> findByRouteIdAndDate(String routeId, LocalDate date);
    List<TripSchedule> findByBusIdAndDate(String busId, LocalDate date);// ✅ ADDED
}
