package com.assignment.scheduler.quartz;

import java.text.ParseException;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.stream.Collectors;

import org.quartz.CronExpression;
import org.quartz.CronScheduleBuilder;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.springframework.stereotype.Component;

import com.assignment.scheduler.common.ValidationException;
import com.assignment.scheduler.scheduling.schedule.CronSchedule;
import com.assignment.scheduler.scheduling.schedule.IntervalSchedule;
import com.assignment.scheduler.scheduling.schedule.OneTimeSchedule;
import com.assignment.scheduler.scheduling.schedule.ScheduleSpec;
import com.assignment.scheduler.scheduling.schedule.WeeklySchedule;

/**
 * Validates {@link ScheduleSpec}s and translates them into Quartz triggers. Pure apart from the injected
 * {@link Clock}, so every rule is unit-testable.
 */
@Component
public class TriggerFactory {

	/** Guards against schedules that would hammer the system (OWASP A06). */
	static final Duration MIN_INTERVAL = Duration.ofMinutes(1);

	static final int MAX_INTERVAL_AMOUNT = 1000;

	static final int MAX_CRON_LENGTH = 120;

	private static final int CRON_FREQUENCY_SAMPLE = 10;

	private final Clock clock;

	public TriggerFactory(Clock clock) {
		this.clock = clock;
	}

	/** @return field-keyed errors ({@code schedule.<field>}); empty when the spec is valid */
	public Map<String, String> validate(ScheduleSpec spec) {
		Map<String, String> errors = new LinkedHashMap<>();
		if (spec == null) {
			errors.put("schedule", "is required");
			return errors;
		}
		ZoneId zone = parseZone(spec.timeZone(), errors);
		switch (spec) {
			case OneTimeSchedule s -> {
				if (s.runAt() == null) {
					errors.put("schedule.runAt", "is required");
				}
				else if (zone != null && !s.runAt().atZone(zone).toInstant().isAfter(clock.instant())) {
					errors.put("schedule.runAt", "must be in the future");
				}
			}
			case IntervalSchedule s -> {
				if (s.every() == null || s.every() < 1 || s.every() > MAX_INTERVAL_AMOUNT) {
					errors.put("schedule.every", "must be between 1 and " + MAX_INTERVAL_AMOUNT);
				}
				if (s.unit() == null) {
					errors.put("schedule.unit", "is required");
				}
			}
			case WeeklySchedule s -> {
				if (s.daysOfWeek() == null || s.daysOfWeek().isEmpty()) {
					errors.put("schedule.daysOfWeek", "select at least one day");
				}
				if (s.time() == null) {
					errors.put("schedule.time", "is required");
				}
			}
			case CronSchedule s -> validateCron(s.expression(), zone, errors);
		}
		return errors;
	}

	/** Builds the trigger for a valid spec; throws {@link ValidationException} otherwise. */
	public Trigger build(ScheduleSpec spec, TriggerKey key) {
		Map<String, String> errors = validate(spec);
		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		TimeZone timeZone = TimeZone.getTimeZone(ZoneId.of(spec.timeZone()));
		Instant now = clock.instant();
		TriggerBuilder<Trigger> builder = TriggerBuilder.newTrigger().withIdentity(key);

		return switch (spec) {
			case OneTimeSchedule s -> builder
				.startAt(Date.from(s.runAt().atZone(timeZone.toZoneId()).toInstant()))
				.withSchedule(SimpleScheduleBuilder.simpleSchedule().withMisfireHandlingInstructionFireNow())
				.build();
			case IntervalSchedule s -> {
				Duration interval = s.unit().times(s.every());
				yield builder.startAt(Date.from(now.plus(interval)))
					.withSchedule(SimpleScheduleBuilder.simpleSchedule()
						.withIntervalInMilliseconds(interval.toMillis())
						.repeatForever()
						.withMisfireHandlingInstructionNextWithRemainingCount())
					.build();
			}
			case WeeklySchedule s -> cronTrigger(builder, toCron(s), timeZone, now);
			case CronSchedule s -> cronTrigger(builder, s.expression().strip(), timeZone, now);
		};
	}

	/** Next {@code count} fire times of a valid spec, for the "upcoming runs" preview in the UI. */
	public List<Instant> preview(ScheduleSpec spec, int count) {
		Trigger trigger = build(spec, TriggerKey.triggerKey("preview"));
		List<Instant> fireTimes = new ArrayList<>(count);
		Date next = trigger.getFireTimeAfter(Date.from(clock.instant()));
		while (next != null && fireTimes.size() < count) {
			fireTimes.add(next.toInstant());
			next = trigger.getFireTimeAfter(next);
		}
		return fireTimes;
	}

	/** Quartz cron equivalent of a weekly schedule, e.g. {@code 0 30 9 ? * MON,WED}. */
	static String toCron(WeeklySchedule schedule) {
		String days = schedule.daysOfWeek().stream()
			.sorted()
			.map(TriggerFactory::quartzDay)
			.collect(Collectors.joining(","));
		return "0 %d %d ? * %s".formatted(schedule.time().getMinute(), schedule.time().getHour(), days);
	}

	private static String quartzDay(DayOfWeek day) {
		return day.name().substring(0, 3);
	}

	private static Trigger cronTrigger(TriggerBuilder<Trigger> builder, String expression, TimeZone timeZone,
			Instant now) {
		return builder.startAt(Date.from(now))
			.withSchedule(CronScheduleBuilder.cronSchedule(expression)
				.inTimeZone(timeZone)
				.withMisfireHandlingInstructionFireAndProceed())
			.build();
	}

	private void validateCron(String expression, ZoneId zone, Map<String, String> errors) {
		if (expression == null || expression.isBlank()) {
			errors.put("schedule.expression", "is required");
			return;
		}
		if (expression.length() > MAX_CRON_LENGTH) {
			errors.put("schedule.expression", "must be at most " + MAX_CRON_LENGTH + " characters");
			return;
		}
		CronExpression cron;
		try {
			cron = new CronExpression(expression.strip());
		}
		catch (ParseException ex) {
			errors.put("schedule.expression", "is not a valid Quartz cron expression (" + ex.getMessage() + ")");
			return;
		}
		if (zone == null) {
			return;
		}
		cron.setTimeZone(TimeZone.getTimeZone(zone));
		Date previous = cron.getNextValidTimeAfter(Date.from(clock.instant()));
		if (previous == null) {
			errors.put("schedule.expression", "never fires in the future");
			return;
		}
		for (int i = 0; i < CRON_FREQUENCY_SAMPLE; i++) {
			Date next = cron.getNextValidTimeAfter(previous);
			if (next == null) {
				return;
			}
			if (Duration.between(previous.toInstant(), next.toInstant()).compareTo(MIN_INTERVAL) < 0) {
				errors.put("schedule.expression", "must not fire more often than once a minute");
				return;
			}
			previous = next;
		}
	}

	private static ZoneId parseZone(String timeZone, Map<String, String> errors) {
		if (timeZone == null || timeZone.isBlank()) {
			errors.put("schedule.timeZone", "is required");
			return null;
		}
		try {
			return ZoneId.of(timeZone);
		}
		catch (DateTimeException ex) {
			errors.put("schedule.timeZone", "is not a valid time zone");
			return null;
		}
	}
}
