package com.assignment.scheduler.scheduling;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;

public record SchedulingResponse(
		UUID id,
		String name,
		String description,
		String taskKey,
		String taskName,
		Map<String, Object> parameters,
		ScheduleSpec schedule,
		boolean enabled,
		SchedulingStatus status,
		Instant nextFireTime,
		long version,
		Instant createdAt,
		Instant updatedAt) {
}
