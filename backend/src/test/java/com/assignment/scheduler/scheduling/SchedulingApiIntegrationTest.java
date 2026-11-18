package com.assignment.scheduler.scheduling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.impl.matchers.GroupMatcher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.assignment.scheduler.TestcontainersConfiguration;
import com.assignment.scheduler.quartz.QuartzJobManager;
import com.assignment.scheduler.task.impl.LogTask;
import com.jayway.jsonpath.JsonPath;

/**
 * End-to-end through HTTP, JPA, Flyway and the Quartz JDBC job store against a real PostgreSQL (Testcontainers).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SchedulingApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private Scheduler scheduler;

	@Autowired
	private SchedulingRepository repository;

	@MockitoSpyBean
	private LogTask logTask;

	@MockitoSpyBean
	private QuartzJobManager jobManager;

	@Test
	void listsPredefinedTasksWithSchemas() throws Exception {
		mvc.perform(get("/api/tasks"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[?(@.key == 'LOG')].parameters[0].name").value("message"))
			.andExpect(jsonPath("$[?(@.key == 'LOG')].parameters[0].required").value(true));
	}

	@Test
	void fullCrudLifecycleKeepsQuartzInSync() throws Exception {
		String body = """
				{"name": "Weekly log", "taskKey": "LOG", "parameters": {"message": "hello"},
				 "schedule": {"type": "WEEKLY", "daysOfWeek": ["MONDAY", "FRIDAY"], "time": "09:30", "timeZone": "Asia/Jerusalem"},
				 "enabled": true}
				""";
		String created = mvc.perform(post("/api/schedulings").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/api/schedulings/")))
			.andExpect(jsonPath("$.status").value("ACTIVE"))
			.andExpect(jsonPath("$.nextFireTime", notNullValue()))
			.andExpect(jsonPath("$.taskName").value("Log message"))
			.andExpect(jsonPath("$.schedule.type").value("WEEKLY"))
			.andExpect(jsonPath("$.version").value(0))
			.andReturn().getResponse().getContentAsString();
		UUID id = UUID.fromString(JsonPath.read(created, "$.id"));
		assertThat(scheduler.checkExists(jobKey(id))).isTrue();

		mvc.perform(get("/api/schedulings/{id}", id)).andExpect(status().isOk())
			.andExpect(jsonPath("$.parameters.message").value("hello"));

		String update = """
				{"name": "Every 10 minutes", "taskKey": "LOG", "parameters": {"message": "updated", "level": "WARN"},
				 "schedule": {"type": "INTERVAL", "every": 10, "unit": "MINUTES", "timeZone": "UTC"},
				 "enabled": false, "version": 0}
				""";
		mvc.perform(put("/api/schedulings/{id}", id).contentType(MediaType.APPLICATION_JSON).content(update))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PAUSED"))
			.andExpect(jsonPath("$.nextFireTime", nullValue()))
			.andExpect(jsonPath("$.version").value(1))
			.andExpect(jsonPath("$.schedule.type").value("INTERVAL"));
		assertThat(scheduler.getJobDetail(jobKey(id)).getJobDataMap().getString("parameters")).contains("updated");

		// Same payload again still carries version 0, which is now stale.
		mvc.perform(put("/api/schedulings/{id}", id).contentType(MediaType.APPLICATION_JSON).content(update))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.title").value("Conflict"));

		mvc.perform(delete("/api/schedulings/{id}", id)).andExpect(status().isNoContent());
		assertThat(scheduler.checkExists(jobKey(id))).isFalse();
		mvc.perform(get("/api/schedulings/{id}", id)).andExpect(status().isNotFound());
	}

	@Test
	void invalidRequestsReturnFieldKeyedProblemDetails() throws Exception {
		String body = """
				{"name": "Bad", "taskKey": "EMAIL", "parameters": {"to": "nope", "extra": "x"},
				 "schedule": {"type": "CRON", "expression": "*/5 * * * * ?", "timeZone": "UTC"}}
				""";
		postScheduling(body).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.title").value("Validation failed"))
			.andExpect(jsonPath("$.errors['parameters.to']").value("must be a valid email address"))
			.andExpect(jsonPath("$.errors['parameters.subject']").value("is required"))
			.andExpect(jsonPath("$.errors['parameters.extra']").exists())
			.andExpect(jsonPath("$.errors['schedule.expression']").value("must not fire more often than once a minute"));

		postScheduling("""
				{"name": "", "taskKey": "LOG", "schedule": {"type": "INTERVAL", "every": 5, "unit": "MINUTES", "timeZone": "UTC"}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors.name").exists());

		// Unknown schedule types are rejected by the subtype allow-list without leaking parser details.
		postScheduling("""
				{"name": "x", "taskKey": "LOG", "schedule": {"type": "EVIL"}}
				""").andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("Failed to read request"));
	}

	@Test
	void previewReturnsUpcomingRuns() throws Exception {
		mvc.perform(post("/api/schedulings/preview").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"CRON\", \"expression\": \"0 0 9 ? * MON-FRI\", \"timeZone\": \"Asia/Jerusalem\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nextFireTimes", hasSize(5)));

		mvc.perform(post("/api/schedulings/preview").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"CRON\", \"expression\": \"bad\", \"timeZone\": \"UTC\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors['schedule.expression']").exists());
	}

	@Test
	void scheduledJobExecutesTaskWithItsParameters() throws Exception {
		String runAt = LocalDateTime.now(ZoneOffset.UTC).plusSeconds(3).truncatedTo(ChronoUnit.SECONDS).toString();
		String created = postScheduling("""
				{"name": "Fire soon", "taskKey": "LOG", "parameters": {"message": "integration hello"},
				 "schedule": {"type": "ONE_TIME", "runAt": "%s", "timeZone": "UTC"}}
				""".formatted(runAt)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
		UUID id = UUID.fromString(JsonPath.read(created, "$.id"));

		await().atMost(Duration.ofSeconds(30))
			.untilAsserted(() -> verify(logTask, atLeastOnce())
				.execute(argThat(ctx -> id.equals(ctx.schedulingId())
						&& "integration hello".equals(ctx.parameters().get("message")))));

		await().atMost(Duration.ofSeconds(10))
			.untilAsserted(() -> mvc.perform(get("/api/schedulings/{id}", id))
				.andExpect(jsonPath("$.status").value("COMPLETED")));
	}

	@Test
	void databaseRowAndQuartzJobRollBackTogether() throws Exception {
		int jobsBefore = scheduler.getJobKeys(GroupMatcher.jobGroupEquals("schedulings")).size();
		doAnswer(invocation -> {
			invocation.callRealMethod(); // the Quartz job IS written...
			throw new IllegalStateException("simulated failure after scheduling"); // ...then the transaction fails
		}).when(jobManager).schedule(any());

		postScheduling("""
				{"name": "Doomed", "taskKey": "LOG", "parameters": {"message": "m"},
				 "schedule": {"type": "INTERVAL", "every": 5, "unit": "MINUTES", "timeZone": "UTC"}}
				""").andExpect(status().isInternalServerError())
			.andExpect(jsonPath("$.detail").value("An unexpected error occurred."));

		assertThat(repository.findAll()).noneMatch(s -> s.getName().equals("Doomed"));
		assertThat(scheduler.getJobKeys(GroupMatcher.jobGroupEquals("schedulings"))).hasSize(jobsBefore);
	}

	private ResultActions postScheduling(String json) throws Exception {
		return mvc.perform(post("/api/schedulings")
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private static JobKey jobKey(UUID id) {
		return JobKey.jobKey(id.toString(), "schedulings");
	}
}
