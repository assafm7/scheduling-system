package com.assignment.scheduler.scheduling.schedule;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * When a scheduling fires. Serialized as JSON with a {@code type} discriminator; only the subtypes listed
 * here can be deserialized (explicit allow-list, no default typing).
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
		@JsonSubTypes.Type(value = OneTimeSchedule.class, name = "ONE_TIME"),
		@JsonSubTypes.Type(value = IntervalSchedule.class, name = "INTERVAL"),
		@JsonSubTypes.Type(value = WeeklySchedule.class, name = "WEEKLY"),
		@JsonSubTypes.Type(value = CronSchedule.class, name = "CRON") })
public sealed interface ScheduleSpec permits OneTimeSchedule, IntervalSchedule, WeeklySchedule, CronSchedule {

	/** IANA time zone the schedule is expressed in, e.g. {@code Asia/Jerusalem}. */
	String timeZone();
}
