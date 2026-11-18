package com.assignment.scheduler.scheduling;

import java.util.Map;

import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Create/update payload. Parameter values and the schedule are validated against the task schema and
 * scheduling rules in {@link SchedulingService}; {@code version} is required on update (optimistic locking).
 */
public record SchedulingRequest(
		@NotBlank @Size(max = 100) String name,
		@Size(max = 500) String description,
		@NotBlank @Size(max = 50) String taskKey,
		@Size(max = 50) Map<String, Object> parameters,
		@NotNull ScheduleSpec schedule,
		Boolean enabled,
		Long version) {
}
