package com.assignment.scheduler.task.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import com.assignment.scheduler.task.TaskContext;

@ExtendWith(OutputCaptureExtension.class)
class TaskImplementationsTest {

	private static final UUID ID = UUID.fromString("11111111-2222-3333-4444-555555555555");

	@Nested
	class Log {

		private final LogTask task = new LogTask();

		@Test
		void logsMessageAtRequestedLevel(CapturedOutput output) {
			task.execute(new TaskContext(ID, Map.of("message", "disk almost full", "level", "WARN")));

			assertThat(output).contains("WARN").contains("[scheduling " + ID + "] disk almost full");
		}

		@Test
		void defaultsToInfo(CapturedOutput output) {
			task.execute(new TaskContext(ID, Map.of("message", "hello")));

			assertThat(output).contains("INFO").contains("hello");
		}

		@Test
		void neutralizesLogInjection(CapturedOutput output) {
			task.execute(new TaskContext(ID, Map.of("message", "legit\nERROR forged entry")));

			assertThat(output).contains("legit ERROR forged entry").doesNotContain("legit\nERROR");
		}
	}

	@Nested
	class Email {

		@Test
		void logsSimulatedEmailWithoutBodyContent(CapturedOutput output) {
			new EmailTask().execute(new TaskContext(ID,
					Map.of("to", "ops@example.com", "subject", "Weekly digest", "body", "secret body text")));

			assertThat(output).contains("Simulated email to <ops@example.com>")
				.contains("\"Weekly digest\"")
				.contains("16 characters")
				.doesNotContain("secret body text");
		}
	}

	@Nested
	class DbReport {

		private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

		private final DbReportTask task = new DbReportTask(jdbcTemplate);

		@Test
		void exposesEveryReportAsAnOption() {
			assertThat(task.parameters()).singleElement()
				.satisfies(p -> assertThat(p.options()).containsExactly("SCHEDULING_COUNT", "SCHEDULINGS_PER_TASK"));
		}

		@Test
		void runsTheFixedQueryForTheSelectedReport(CapturedOutput output) {
			String sql = DbReportTask.Report.SCHEDULINGS_PER_TASK.sql();
			when(jdbcTemplate.queryForList(sql)).thenReturn(List.of(Map.of("task_key", "LOG", "total", 2)));

			task.execute(new TaskContext(ID, Map.of("report", "SCHEDULINGS_PER_TASK")));

			verify(jdbcTemplate).queryForList(sql);
			assertThat(output).contains("SCHEDULINGS_PER_TASK").contains("task_key=LOG");
		}
	}
}
