import { createOpenAPIApp } from "@/lib/openapi";
import * as routes from "./routes";
import * as service from "./service";

export const dailyQuestion = createOpenAPIApp();

// GET /daily-question/today
dailyQuestion.openapi(routes.getTodayDailyQuestionRoute, async (c) =>
	c.json(await service.getTodayDailyQuestion(c), 200),
);

// PUT /daily-question/today
dailyQuestion.openapi(routes.putTodayDailyQuestionRoute, async (c) => {
	const body = c.req.valid("json");
	return c.json(await service.putTodayDailyQuestion(c, body), 200);
});

export default dailyQuestion;
