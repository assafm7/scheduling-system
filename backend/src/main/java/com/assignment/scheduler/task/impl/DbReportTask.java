package com.assignment.scheduler.task.impl;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.assignment.scheduler.task.ParameterDefinition;
import com.assignment.scheduler.task.ScheduledTask;
import com.assignment.scheduler.task.TaskContext;

/**
 * Runs one of a fixed set of read-only reporting queries and logs the result. The user only picks a report
 * from an allow-list; no user input ever becomes part of the SQL.
 */
@Component
public class DbReportTask implements ScheduledTask {

	public static final String KEY = "DB_REPORT";

	private static final Logger log = LoggerFactory.getLogger(DbReportTask.class);

	enum Report {
		SCHEDULING_COUNT("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE enabled) AS enabled FROM scheduling"),
		SCHEDULINGS_PER_TASK("SELECT task_key, COUNT(*) AS total FROM scheduling GROUP BY task_key ORDER BY task_key");

		private final String sql;

		Report(String sql) {
			this.sql = sql;
		}
	}

	private final JdbcTemplate jdbcTemplate;

	public DbReportTask(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@Override
	public String key() {
		return KEY;
	}

	@Override
	public String name() {
		return "Database report";
	}

	@Override
	public String description() {
		return "Runs a predefined read-only query against the database and logs the result.";
	}

	@Override
	public List<ParameterDefinition> parameters() {
		return List.of(ParameterDefinition.choice("report", "Report", true,
				Arrays.stream(Report.values()).map(Enum::name).toList(), "Which predefined query to run."));
	}

	@Override
	public void execute(TaskContext context) {
		Report report = Report.valueOf(context.requireString("report"));
		List<Map<String, Object>> rows = jdbcTemplate.queryForList(report.sql);
		log.info("[scheduling {}] {} -> {}", context.schedulingId(), report, rows);
	}
}
