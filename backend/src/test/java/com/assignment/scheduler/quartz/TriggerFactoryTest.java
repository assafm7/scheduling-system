package com.assignment.scheduler.quartz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.quartz.CronTrigger;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerKey;

import com.assignment.scheduler.common.ValidationException;
import com.assignment.scheduler.scheduling.schedule.CronSchedule;
import com.assignment.scheduler.scheduling.schedule.IntervalSchedule;
import com.assignment.scheduler.scheduling.schedule.IntervalUnit;
import com.assignment.scheduler.scheduling.schedule.OneTimeSchedule;
import com.assignment.scheduler.scheduling.schedule.WeeklySchedule;

class TriggerFactoryTest {

	/** Monday 2026-01-05 10:00 UTC = 12:00 in Jerusalem (UTC+2 in winter). */
	private static final Instant NOW = Instant.parse("2026-01-05T10:00:00Z");

	private static final String JERUSALEM = "Asia/Jerusalem";

	private static final TriggerKey KEY = TriggerKey.triggerKey("t");

	private final TriggerFactory factory = new TriggerFactory(Clock.fixed(NOW, ZoneOffset.UTC));

	@Test
	void oneTimeFiresOnceAtLocalTimeInZone() {
		Trigger trigger = factory.build(new OneTimeSchedule(LocalDateTime.parse("2026-01-05T15:00:00"), JERUSALEM), KEY);

		assertThat(trigger).isInstanceOf(SimpleTrigger.class);
		assertThat(trigger.getStartTime().toInstant()).isEqualTo(Instant.parse("2026-01-05T13:00:00Z"));
		assertThat(((SimpleTrigger) trigger).getRepeatCount()).isZero();
		assertThat(trigger.getMisfireInstruction()).isEqualTo(SimpleTrigger.MISFIRE_INSTRUCTION_FIRE_NOW);
	}

	@Test
	void oneTimeMustBeInTheFuture() {
		// 11:59 in Jerusalem is 09:59 UTC, one minute before NOW
		assertThat(factory.validate(new OneTimeSchedule(LocalDateTime.parse("2026-01-05T11:59:00"), JERUSALEM)))
			.containsExactly(entry("schedule.runAt", "must be in the future"));
		assertThat(factory.validate(new OneTimeSchedule(null, JERUSALEM))).containsKey("schedule.runAt");
	}

	@Test
	void intervalRepeatsForeverStartingOneIntervalFromNow() {
		SimpleTrigger trigger = (SimpleTrigger) factory.build(new IntervalSchedule(15, IntervalUnit.MINUTES, "UTC"), KEY);

		assertThat(trigger.getRepeatInterval()).isEqualTo(Duration.ofMinutes(15).toMillis());
		assertThat(trigger.getRepeatCount()).isEqualTo(SimpleTrigger.REPEAT_INDEFINITELY);
		assertThat(trigger.getStartTime().toInstant()).isEqualTo(NOW.plus(Duration.ofMinutes(15)));
	}

	@Test
	void intervalSupportsHoursAndDays() {
		assertThat(((SimpleTrigger) factory.build(new IntervalSchedule(2, IntervalUnit.HOURS, "UTC"), KEY))
			.getRepeatInterval()).isEqualTo(Duration.ofHours(2).toMillis());
		assertThat(((SimpleTrigger) factory.build(new IntervalSchedule(1, IntervalUnit.DAYS, "UTC"), KEY))
			.getRepeatInterval()).isEqualTo(Duration.ofDays(1).toMillis());
	}

	@ParameterizedTest
	@ValueSource(ints = { 0, -5, 1001 })
	void intervalAmountMustBeInRange(int every) {
		assertThat(factory.validate(new IntervalSchedule(every, IntervalUnit.MINUTES, "UTC")))
			.containsExactly(entry("schedule.every", "must be between 1 and 1000"));
	}

	@Test
	void intervalRequiresAmountAndUnit() {
		assertThat(factory.validate(new IntervalSchedule(null, null, "UTC")))
			.containsOnlyKeys("schedule.every", "schedule.unit");
	}

	@Test
	void weeklyBecomesSortedQuartzCron() {
		WeeklySchedule weekly = new WeeklySchedule(Set.of(DayOfWeek.WEDNESDAY, DayOfWeek.MONDAY), LocalTime.of(9, 30),
				JERUSALEM);

		assertThat(TriggerFactory.toCron(weekly)).isEqualTo("0 30 9 ? * MON,WED");
		CronTrigger trigger = (CronTrigger) factory.build(weekly, KEY);
		assertThat(trigger.getCronExpression()).isEqualTo("0 30 9 ? * MON,WED");
		assertThat(trigger.getTimeZone().getID()).isEqualTo(JERUSALEM);
	}

	@Test
	void weeklyRequiresDaysAndTime() {
		assertThat(factory.validate(new WeeklySchedule(Set.of(), null, "UTC")))
			.containsOnlyKeys("schedule.daysOfWeek", "schedule.time");
	}

	@Test
	void cronUsesExpressionAndZone() {
		CronTrigger trigger = (CronTrigger) factory.build(new CronSchedule(" 0 0 9 ? * MON-FRI ", JERUSALEM), KEY);

		assertThat(trigger.getCronExpression()).isEqualTo("0 0 9 ? * MON-FRI");
		assertThat(trigger.getTimeZone().getID()).isEqualTo(JERUSALEM);
		assertThat(trigger.getMisfireInstruction()).isEqualTo(CronTrigger.MISFIRE_INSTRUCTION_FIRE_ONCE_NOW);
	}

	@Test
	void cronValidation() {
		assertThat(factory.validate(new CronSchedule("not a cron", "UTC")).get("schedule.expression"))
			.startsWith("is not a valid Quartz cron expression");
		assertThat(factory.validate(new CronSchedule("*/10 * * * * ?", "UTC")))
			.containsEntry("schedule.expression", "must not fire more often than once a minute");
		assertThat(factory.validate(new CronSchedule("0 0 12 1 1 ? 2020", "UTC")))
			.containsEntry("schedule.expression", "never fires in the future");
		assertThat(factory.validate(new CronSchedule(" ", "UTC"))).containsEntry("schedule.expression", "is required");
		assertThat(factory.validate(new CronSchedule("0 ".repeat(61), "UTC")))
			.containsEntry("schedule.expression", "must be at most 120 characters");
		assertThat(factory.validate(new CronSchedule("0 * * * * ?", "UTC"))).isEmpty();
	}

	@Test
	void timeZoneIsRequiredAndValidated() {
		assertThat(factory.validate(new CronSchedule("0 0 9 * * ?", "Mars/Olympus")))
			.containsExactly(entry("schedule.timeZone", "is not a valid time zone"));
		assertThat(factory.validate(new IntervalSchedule(5, IntervalUnit.MINUTES, null)))
			.containsExactly(entry("schedule.timeZone", "is required"));
	}

	@Test
	void missingScheduleIsReported() {
		assertThat(factory.validate(null)).containsExactly(entry("schedule", "is required"));
	}

	@Test
	void buildRejectsInvalidSpecs() {
		assertThatThrownBy(() -> factory.build(new IntervalSchedule(0, IntervalUnit.MINUTES, "UTC"), KEY))
			.isInstanceOfSatisfying(ValidationException.class,
					ex -> assertThat(ex.getErrors()).containsKey("schedule.every"));
	}

	@Test
	void previewListsUpcomingFireTimesInZone() {
		// NOW is Monday 12:00 in Jerusalem, so Monday 09:30 has passed: next runs are Wed, then next Mon, Wed...
		List<Instant> times = factory.preview(
				new WeeklySchedule(Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), LocalTime.of(9, 30), JERUSALEM), 3);

		assertThat(times).containsExactly(Instant.parse("2026-01-07T07:30:00Z"), Instant.parse("2026-01-12T07:30:00Z"),
				Instant.parse("2026-01-14T07:30:00Z"));
	}

	@Test
	void previewOfOneTimeHasSingleEntry() {
		assertThat(factory.preview(new OneTimeSchedule(LocalDateTime.parse("2026-01-06T08:00:00"), "UTC"), 5))
			.containsExactly(Instant.parse("2026-01-06T08:00:00Z"));
	}

	@Test
	void previewOfIntervalIsEvenlySpaced() {
		assertThat(factory.preview(new IntervalSchedule(2, IntervalUnit.HOURS, "UTC"), 3)).containsExactly(
				NOW.plus(Duration.ofHours(2)), NOW.plus(Duration.ofHours(4)), NOW.plus(Duration.ofHours(6)));
	}

	private static java.util.Map.Entry<String, String> entry(String key, String value) {
		return java.util.Map.entry(key, value);
	}
}
