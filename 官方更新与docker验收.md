我打算二开bifrost,我已经将其fork到了我的仓库https://github.com/mostly925/bifrost.git
请你将他拉下来,然后建一个分支tiniwork_api,切换到tiniwork_api分支,然后再推上去
假设今后官方仓库更新后，先让我的 main 跟上官方：
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
再把官方更新合入定制分支：
git switch tiniwork_api
git merge main
没有冲突就验证并推送：
git push origin tiniwork_api
有冲突时，Git 会明确列出冲突文件。解决后：
git add <已解决的文件>
git commit
git push origin tiniwork_api
不要用强制推送，也不建议每次升级使用 rebase。长期维护的部署分支使用 merge 更容易追踪“哪次官方升级引入了什么”。
Docker 注意:
修改源码后不能继续直接运行官方镜像,
它不包含我的修改。需要从 tiniwork_api 分支构建自己的镜像，例如：
docker build -t mostly925/tiniwork_api:2026-08-16 .
生产升级建议按以下顺序进行：
1. 备份数据库和 /data 持久化目录。
2. 将官方更新合并到 tiniwork_api。
3. 本地或测试服务器完成前端、后端和数据库迁移验证。
4. 构建带明确版本号的新镜像。
5. 更新 Docker Compose 镜像版本并重启。
6. 验证登录、注册、控制台、渠道调用和计费记录。


# Docker构建
在 `F:\bifrost` 根目录执行两步即可。

**1. 构建镜像**（必须用 `Dockerfile.local`，它会把 `core/`、`framework/`、`plugins/`、`transports/` 全部从你的本地源码编译进去；默认的 `Dockerfile` 只编译 transports，其余模块从网上拉已发布版本，你的二开改动会丢）：

```powershell
docker build -f transports/Dockerfile.local -t bifrost .
```

仓库自带的 `make docker-image LOCAL=1` 是同一件事，但 Makefile 里的 shell 语法在 Windows PowerShell 下不兼容，直接用上面这条 docker 命令最稳。

**2. 运行容器**：
可以用两条命令确认镜像确实存在且能跑起来：

```powershell
# 确认镜像存在及大小
docker images bifrost

# 启动容器验证
docker run -d --name bifrost -p 8080:8080 -v F:\bifrost\data:/app/data bifrost
docker logs -f bifrost
```

日志里看到 HTTP 服务监听 8080 的输出后，浏览器访问 `http://localhost:8080` 能打开 UI 就是完整可用了。
`/app/data` 挂载到宿主机是为了持久化数据库和配置；要指定配置文件再加一条挂载 `-v F:\bifrost\config.json:/app/data/config.json`。

日常二开迭代就是改完代码重复第 1、2 步（先 `docker rm -f bifrost` 删旧容器再重建）。构建需要联网拉基础镜像和 Go 模块，Docker Desktop 会走系统代理，不需要额外配置。

# 停止并删除容器
```powershell
docker rm -f bifrost
```
如果只是想暂停、以后还用这个容器，用 
```powershell
# 停止（保留容器）
docker stop bifrost
# 恢复
docker start bifrost
```

# 镜像上传
留意别把 `docker commit` 用在跑过调试的容器上再导出——那会把容器读写层里的数据打进去，用 `docker build` 产出的镜像是干净的。

**方式一：离线导出传输（服务器无外网或不想用仓库时）**

```powershell
# 导出为 tar 文件（约几百 MB 到 1GB）
docker save -o bifrost.tar bifrost

# 上传到服务器
scp bifrost.tar user@your-server:/tmp/

# 在服务器上加载并运行
ssh user@your-server
docker load -i /tmp/bifrost.tar
docker run -d --name bifrost -p 8080:8080 -v /srv/bifrost/data:/app/data bifrost
```

服务器的 `/srv/bifrost/data` 是它自己的持久化目录，和本地的 `F:\bifrost\data` 完全无关。

**方式二：推送到镜像仓库（推荐，便于后续反复更新）**

```powershell
# 打版本标签并推送（以 Docker Hub 为例，也可用阿里云 ACR、GHCR）
docker tag bifrost mostly925/bifrost:v1
docker push mostly925/bifrost:v1

# 服务器上直接拉取
docker pull mostly925/bifrost:v1
```

以后每次二开发版就重复：改代码 → `docker build` → `tag` 新版本号 → `push` → 服务器 `pull`。比 tar 文件好在增量传输和版本可回滚。

两点提醒：走 Docker Hub 推送需要 `docker login`；国内服务器拉取慢的话用阿里云个人版 ACR 做中转。另外如果配置文件里有密钥之类敏感信息，确认它们只在挂载的 config.json 里、没有写死在源码或 Dockerfile 中再上传。