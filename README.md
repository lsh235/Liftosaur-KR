# 🏋 Liftosaur: Open-source powerful weight lifting tracker PWA for coders.

* Link: https://www.liftosaur.com
* **[Features roadmap](https://github.com/astashov/liftosaur/discussions)**
* **[Bugs](https://github.com/astashov/liftosaur/issues)**

<img src="https://raw.github.com/astashov/liftosaur/master/screenshot2.png" alt="Liftosaur Screenshot" width="360" />

It's mobile app, that's available as:

- [PWA](https://www.liftosaur.com/app) - meaning you can open the page in a browser on your mobile phone, add it to a home screen, and it will behave exactly as a regular app.
- [Android app](https://play.google.com/store/apps/details?id=com.liftosaur.www.twa?referrer=utm_source%3Dgithub) - thin Android app around this PWA with some native features added.
- [iOS app](https://apps.apple.com/app/apple-store/id1661880849?pt=126680920&mt=8&ct=github) - thin iOS app around this PWA with some native features added.

The main idea is to make a weightlifting tracker app, that is flexible enough to implement pretty much any weightlifting routine. It would be a platform for your experiments in weightlifting, you can try any progression and deloading logic you want to see what suits you better. It automatically handles progressive overloads and deloads based on the logic you define. Any program should be possible to implement - Stronglifts 5x5, GZCLP, any 5/3/1s, any PPL, you name it.

To describe the logic, there's a built-in scripting language called [Liftoscript](https://www.liftosaur.com/doc), which is a very simple programming language with JavaScript-like syntax. It has some built-in variables and some custom number types (e.g. `kg` and `lb`), but other than that it's pretty simple. E.g. Stronglifts 5x5 logic could look like this if written in Liftoscript:

```js
if (completedReps >= reps) {
  state.weight = state.weight + 5lb
} else {
  state.failures = state.failures + 1
}
if (state.failures > 2) {
  state.failures = 0
  state.weight = state.weight * 0.9
}
```

# Features

- Built-in workout programs - 5/3/1, GZCLP, Starting Strength, etc
- Any workout program is fully customizable - you can clone existing one and adjust it to your needs. Every single program is written using Liftoscript right in the app, so every bit of it could be changed.
- Simple exercise editor if you don't want to mess with Liftoscript, that still allows to specify simple progression/deload logic.
- Advanced exercise editor if you want to unleash the full power of Liftoscript.
- Workout history
- Offline mode, it doesn't need Internet to work (still needs though if you have an account and want to save progress).
- Plates calculator right on the progress screen. Each weight is prefixed with plates you need to use to get to that weight, it looks like: `45/25/25/10 255lb` meaning you need to add 1x45lb, 2x25lb and 1x10lb plates on each side of the olympic barbell to get `255lb`. You define your plates inventory in Settings.
- All weights are rounded according to your available bars and plates, which you set up in Settings.
- Rest Timers - configurable globally and per exercise, with a Push Notification when the timer is expired (works only on native apps though).
- Cloud storage - if you create an account, your progress will be saved on the server.
- Graphs - see the visual progression of your lifts, define what Graphs you need on the Graphs screen.
- Muscle map - see what muscles get activated in your day or in the whole program relatively to each other.
- Exercise substitution based on similar activated muscles.
- Custom exercises.
- Warmup sets, which you can configure as a percentage of the weight of the first set, or just as an absolute lb or kg value. Each exercise has defaults, but you can change it.
- "Playgrounds" when editing exercises, so you could test the logic or exercises.
- Previews of each program available, with playgrounds, e.g. [Basic Beginner Routine](https://www.liftosaur.com/programs/basicBeginner).
- If you did similar sets x reps for some exercise previously, it shows your last results. Same for AMRAPs.
- Optional public profile page, e.g. this is [mine](https://www.liftosaur.com/profile/tiolnbjbleke).
- Track bodyweight and other body measurements (biceps, chest, waist, etc)
- Correlate bodyweight changes with lifts graphs
- Web Editor to create programs
- Shareable programs - you can build a program, generate a link, and import on another phone.

# 한국어: AI 운동 루틴 가져오기와 내보내기

설정의 **가져오기 / 내보내기**에서 외부 AI가 작성한 주차별 운동 루틴을 JSON 또는 CSV로 가져올 수 있습니다. 앱은 외부 AI API를 호출하지 않습니다. **AI에게 새 루틴 요청하는 프롬프트 복사**로 규격을 복사해 ChatGPT, Claude 등에서 루틴을 만들고, 결과 파일을 앱에서 선택하세요. `target_weight`가 `0`인 세트는 개인 중량이 없는 것으로 처리되어 운동 중 직접 입력할 수 있습니다.

JSON은 `program_name`, `duration_weeks`, `days_per_week`, `workouts`를 포함해야 합니다. 각 운동은 `weekly_progression`에 전체 주차를 포함하고 세트 유형은 `WARMUP`, `TOP`, `BACKOFF`, `STRAIGHT`, `DROP` 중 하나를 사용합니다. CSV는 한 줄에 한 세트를 기록하며 아래 헤더를 사용합니다.

```csv
program_name,duration_weeks,days_per_week,weight_unit,day_index,day_name,exercise_order,exercise_name,target_muscle,rest_seconds,week,set_no,set_type,target_weight,target_reps
```

앱에는 **6주 PHAT 평일 5일 샘플 루틴**도 포함되어 있습니다. 설정에서 샘플을 추가하면 6주 × 5일의 운동일과 주차별 세트가 생성됩니다. 샘플의 목표 중량은 비어 있으므로 운동 전에 본인에게 맞는 중량을 입력하세요.

**AI 피드백용 Markdown 내보내기**에서는 프로그램 총평, 통증 메모, 다음 루틴 요청을 입력할 수 있습니다. 파일에는 기록 기간과 완료 세션 수, 다관절 운동의 첫·마지막 기록 e1RM 비교, 세션별 목표와 실제 수행 및 볼륨이 담깁니다. 현재 기록 모델은 예정 날짜나 일정 미루기 횟수를 저장하지 않아 출석률과 일정 밀림은 계산하지 않는다고 파일에 표시합니다.

# Implementation details

It's a regular Preact/TypeScript app. State manager is custom, similar to Redux + Thunks, but using [lens-shmens](https://github.com/astashov/lens-shmens#why) to avoid Redux-like boilerplate. It's a PWA, so there's a simple service worker, that caches the network calls. The setup is similar to what's described in [this blog post](https://www.liftosaur.com/blog/posts/offline-mode-in-liftosaur/).

I try to be efficient with the JavaScript size, and avoid heavy third-party libraries. As a result, the whole app weights ~200kb, where ~100kb are various third-party libs. The major third-party libs are:

- [CodeMirror](https://codemirror.net/) for the code editor
- [Preact](https://preactjs.com/) for a view layer
- [Prism](https://prismjs.com/) for code highlighting
- [uPlot](https://github.com/leeoniya/uPlot) for graphs
- [Rollbar](https://rollbar.com/) for error reporting
- [11ty](https://www.11ty.dev/) for the blog
- [Cypress](https://www.cypress.io/) for integration tests
- [Tailwind CSS](https://tailwindcss.com/) for CSS
- [Jimp](https://github.com/oliver-moran/jimp) for generating dynamic `og:image` images (like [this](https://www.liftosaur.com/profileimage/tiolnbjbleke)) for social media

For RPE multiplier calculations we use the formula from https://gitlab.com/openpowerlifting/plsource

Server-side part is AWS Lambdas + DynamoDB + S3 + a bunch of other AWS services. DynamoDB is not a great choice for this app, I'd prefer a relational database here, frankly. But AWS Lambdas + DynamoDB + S3 are pretty cheap, easily scalable, fully managed with backups, so sticking with it for now.

I deploy everything via AWS CDK, the setup is described in [this blog post](liftosaur.com/blog/posts/how-i-moved-liftosaur-from-cloudflare-workers-to-lambda/). I also created an [AWS CDK Lambda TypeScript starter](https://github.com/astashov/aws-cdk-lambda-typescript-starter), to simplify creating similar environment for pet projects.

# How to run locally

If you want to run liftosaur locally firstly ensure that you have Node 18 and npm installed

Then comment out the 
```
devServer:{ }
```
block from the `webpack.config.js` file

Run
```
$ npm install
$ npm start
```

Then, open http://localhost:8080/app. That's it! But that will only give you offline-like experience, so there will be no local API server running.

Running the server is a bit trickier, and frankly still tied to `liftosaur.com` domain, so probably would not be easy to run, you'd need to modify a bunch of things in `liftosaur-cdk/liftosaur-cdk.ts` file. If you still want to try, then you need to set up AWS account, add `AWS_ACCESS_KEY_ID`,`AWS_SECRET_ACCESS_KEY`,`AWS_REGION` env vars, and set the necessary permission policies for your user:

- SecretsManagerReadWrite
- AmazonDynamoDBFullAccess
- AmazonEC2ContainerRegistryFullAccess
- AmazonS3FullAccess
- CloudFrontFullAccess
- AmazonSESFullAccess
- AmazonAPIGatewayAdministrator
- AmazonSSMFullAccess
- AmazonRoute53FullAccess
- AWSCloudFormationFullAccess
- AmazonElasticContainerRegistryPublicFullAccess
- AWSLambdaFullAccess

Create new secrets in AWS Secrets Manager, with the names listed in `secretArns` variable in `liftosaur-cdk.ts`. Those could be pretty much any random strings.

Then, run `npm cdk-deploy`, that should create 2 environments - one for prod, one for dev. Again, there could be some things you want to change in `lifosaur-cdk.ts` to make it work. After that, run `npm start:server`, and it will start a local server.

# Contributing

If you want to propose a feature, or found a bug - [create an issue](https://github.com/astashov/liftosaur/issues) on Github.
