package com.assignment.scheduler.quartz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.slf4j.MDC;

import com.assignment.scheduler.task.ParameterDefinition;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskContext;
import com.assignment.scheduler.task.TaskRegistry;

class TaskExecutionJobTest {

	private static final UUID ID = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

	private final RecordingTask task = new RecordingTask();

	private final TaskExecutionJob job = new TaskExecutionJob(new TaskRegistry(List.of(task)));

	@Test
	void runsTheTaskWithItsStoredParameters() throws Exception {
		job.execute(context("REC", "{\"message\":\"hi\",\"count\":3}"));

		assertThat(task.received).singleElement().satisfies(ctx -> {
			assertThat(ctx.schedulingId()).isEqualTo(ID);
			assertThat(ctx.parameters()).containsEntry("message", "hi").containsEntry("count", 3);
		});
		assertThat(MDC.get("schedulingId")).isNull();
	}

	@Test
	void unknownTaskFailsWithoutImmediateRefire() {
		assertThatThrownBy(() -> job.execute(context("GONE", "{}")))
			.isInstanceOfSatisfying(JobExecutionException.class, ex -> {
				assertThat(ex.refireImmediately()).isFalse();
				assertThat(ex.getCause()).hasMessageContaining("Unknown task 'GONE'");
			});
	}

	@Test
	void taskFailureIsContained() {
		task.failWith = new IllegalStateException("boom");

		assertThatThrownBy(() -> job.execute(context("REC", "{}")))
			.isInstanceOfSatisfying(JobExecutionException.class, ex -> {
				assertThat(ex.refireImmediately()).isFalse();
				assertThat(ex.getCause()).hasMessage("boom");
			});
		assertThat(MDC.get("taskKey")).isNull();
	}

	private static JobExecutionContext context(String taskKey, String parametersJson) {
		JobDataMap data = new JobDataMap(Map.of(TaskExecutionJob.SCHEDULING_ID, ID.toString(),
				TaskExecutionJob.TASK_KEY, taskKey, TaskExecutionJob.PARAMETERS, parametersJson));
		JobExecutionContext context = mock(JobExecutionContext.class);
		when(context.getMergedJobDataMap()).thenReturn(data);
		return context;
	}

	static class RecordingTask implements ScheduledTask {

		final List<TaskContext> received = new ArrayList<>();

		RuntimeException failWith;

		@Override
		public String key() {
			return "REC";
		}

		@Override
		public String name() {
			return "Recording";
		}

		@Override
		public String description() {
			return "";
		}

		@Override
		public List<ParameterDefinition> parameters() {
			return List.of();
		}

		@Override
		public void execute(TaskContext context) {
			if (failWith != null) {
				throw failWith;
			}
			received.add(context);
		}
	}
}
